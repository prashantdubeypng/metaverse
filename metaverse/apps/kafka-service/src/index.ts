import { Kafka, type Producer, type Consumer } from 'kafkajs';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const client = new PrismaClient();

// Kafka configuration with error handling and reconnection
const kafkaConfig: any = {
    clientId: `metaverse-kafka-${process.env.SERVICE_ID || 'default'}`,
    brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    retry: {
        initialRetryTime: 1000,
        retries: 5,
        maxRetryTime: 30000,
        factor: 2
    },
    connectionTimeout: 10000,
    requestTimeout: 30000
};

// Add SSL configuration if provided
if (process.env.KAFKA_SSL_CA) {
    kafkaConfig.ssl = {
        ca: [fs.readFileSync(process.env.KAFKA_SSL_CA, "utf-8")]
    };
}

// Add SASL configuration if provided
if (process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD) {
    kafkaConfig.sasl = {
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
        mechanism: "plain"
    };
}

const kafka = new Kafka(kafkaConfig);

let producer: Producer | null = null;
let consumer: Consumer | null = null;
let isShuttingDown = false;

// Enhanced producer with connection pooling and retry logic
export async function createproducer(): Promise<Producer> {
    if (producer && !isShuttingDown) {
        return producer;
    }

    try {
        const _producer = kafka.producer({
            maxInFlightRequests: 1,
            idempotent: true,
            transactionTimeout: 30000,
            retry: {
                initialRetryTime: 1000,
                retries: 5,
                maxRetryTime: 30000,
                factor: 2
            }
        });

        await _producer.connect();
        producer = _producer;
        
        console.log('Kafka producer connected successfully');
        
        // Handle producer events
        _producer.on('producer.connect', () => {
            console.log('Producer connected');
        });
        
        _producer.on('producer.disconnect', () => {
            console.log('Producer disconnected');
            producer = null;
        });
        
        _producer.on('producer.network.request_timeout', (event) => {
            console.warn(`Producer request timeout:`, event);
        });

        return _producer;
    } catch (error) {
        console.error('Failed to create Kafka producer:', error);
        producer = null;
        throw error;
    }
}

// Enhanced message producer with batching and error handling
export async function producermessage(message: string, topic: string = 'message'): Promise<void> {
    const maxRetries = 3;
    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            const _producer = await createproducer();
            
            await _producer.send({
                topic,
                messages: [
                    {
                        key: `${topic}-${Date.now()}-${Math.random()}`,
                        value: message,
                        timestamp: Date.now().toString(),
                        headers: {
                            'content-type': 'application/json',
                            'service-id': process.env.SERVICE_ID || 'chat-service',
                            'version': '1.0'
                        }
                    }
                ]
            });

            console.log(`Message sent to topic ${topic} successfully`);
            return;

        } catch (error) {
            attempts++;
            console.error(`Failed to send message to Kafka (attempt ${attempts}/${maxRetries}):`, error);
            
            if (attempts >= maxRetries) {
                throw new Error(`Failed to send message after ${maxRetries} attempts: ${error}`);
            }
            
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
        }
    }
}

// Enhanced consumer with error handling and automatic reconnection
export async function createconsumer(): Promise<Consumer> {
    try {
        const groupId = `metaverse-group-${process.env.SERVICE_ID || 'default'}`;
        const _consumer = kafka.consumer({ 
            groupId,
            sessionTimeout: 30000,
            heartbeatInterval: 3000,
            maxWaitTimeInMs: 5000,
            retry: {
                initialRetryTime: 1000,
                retries: 5,
                maxRetryTime: 30000,
                factor: 2
            }
        });

        await _consumer.connect();
        console.log(`Kafka consumer connected with group ID: ${groupId}`);

        // Subscribe to multiple topics
        await _consumer.subscribe({ 
            topics: ['message', 'chat_analytics', 'user_events'],
            fromBeginning: false 
        });

        await _consumer.run({
            autoCommit: true,
            partitionsConsumedConcurrently: 3,
            eachMessage: async ({ topic, partition, message, heartbeat }) => {
                try {
                    // Call heartbeat to avoid session timeout
                    await heartbeat();

                    const messageData = JSON.parse(message.value?.toString() || '{}');
                    console.log(`Processing message from topic ${topic}, partition ${partition}`);

                    // Route message based on topic
                    switch (topic) {
                        case 'message':
                            await handleChatMessage(messageData);
                            break;
                        case 'chat_analytics':
                            await handleAnalyticsMessage(messageData);
                            break;
                        case 'user_events':
                            await handleUserEvent(messageData);
                            break;
                        default:
                            console.warn(`Unknown topic: ${topic}`);
                    }

                    console.log(`Message processed successfully from topic ${topic}`);

                } catch (error) {
                    console.error(`Error processing message from topic ${topic}:`, error);
                    
                    // Dead letter queue logic could be implemented here
                    await handleProcessingError(topic, message, error);
                }
            },
        });

        // Handle consumer events
        _consumer.on('consumer.connect', () => {
            console.log('Consumer connected');
        });

        _consumer.on('consumer.disconnect', () => {
            console.log('Consumer disconnected');
        });

        _consumer.on('consumer.crash', (event) => {
            console.error('Consumer crashed:', event);
            // Implement restart logic here if needed
        });

        consumer = _consumer;
        return _consumer;

    } catch (error) {
        console.error('Failed to create Kafka consumer:', error);
        throw error;
    }
}

// Handle chat messages
async function handleChatMessage(messageData: any): Promise<void> {
    try {
        // Extract data based on message structure
        const data = messageData.data || messageData;
        
        // Save to database with duplicate prevention
        const existingMessage = data.messageId ? 
            await client.message.findUnique({ where: { id: data.messageId } }) : 
            null;

        if (!existingMessage) {
            await client.message.create({
                data: {
                    id: data.messageId,
                    content: data.content || data.message,
                    userId: data.userId,
                    chatroomId: data.chatroomId || data.roomId,
                    createdAt: data.timestamp ? new Date(data.timestamp) : new Date()
                }
            });
            console.log('Chat message saved to database');
        } else {
            console.log('Message already exists, skipping');
        }

        // Update analytics
        await updateChatAnalytics(data);

    } catch (error) {
        console.error('Error handling chat message:', error);
        throw error;
    }
}

// Handle analytics messages
async function handleAnalyticsMessage(messageData: any): Promise<void> {
    try {
        // Process analytics data
        console.log('Processing analytics message:', messageData);
        
        // Could save to a separate analytics database or send to external services
        // For now, just log the analytics data
    } catch (error) {
        console.error('Error handling analytics message:', error);
        throw error;
    }
}

// Handle user events
async function handleUserEvent(messageData: any): Promise<void> {
    try {
        console.log('Processing user event:', messageData);
        
        // Handle user connection/disconnection events
        // Could update user status, activity tracking, etc.
    } catch (error) {
        console.error('Error handling user event:', error);
        throw error;
    }
}

// Update chat analytics
async function updateChatAnalytics(data: any): Promise<void> {
    try {
        // Update or create analytics record
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // This could be expanded to track various metrics
        // For now, just track basic message counts
        
    } catch (error) {
        console.error('Error updating analytics:', error);
    }
}

// Handle processing errors
async function handleProcessingError(topic: string, message: any, error: any): Promise<void> {
    try {
        console.error(`Processing error for topic ${topic}:`, error);
        
        // Could implement dead letter queue logic here
        // For now, just log the error
        
        // Optionally, could send error to monitoring service
        await producermessage(JSON.stringify({
            type: 'processing_error',
            topic,
            error: error.message,
            message: message.value?.toString(),
            timestamp: Date.now()
        }), 'error_logs');
        
    } catch (logError) {
        console.error('Failed to log processing error:', logError);
    }
}

// Batch message producer for high throughput
export async function produceBatchMessages(messages: Array<{ topic: string; message: string }>): Promise<void> {
    try {
        const _producer = await createproducer();
        
        // Group messages by topic
        const topicBatches: Record<string, any[]> = {};
        
        messages.forEach(({ topic, message }) => {
            if (!topicBatches[topic]) {
                topicBatches[topic] = [];
            }
            topicBatches[topic].push({
                key: `${topic}-${Date.now()}-${Math.random()}`,
                value: message,
                timestamp: Date.now().toString()
            });
        });

        // Send batches
        await Promise.all(
            Object.entries(topicBatches).map(([topic, batch]) =>
                _producer.send({ topic, messages: batch })
            )
        );

        console.log(`Sent ${messages.length} messages in batches`);
    } catch (error) {
        console.error('Failed to send batch messages:', error);
        throw error;
    }
}

// Health check function
export async function kafkaHealthCheck(): Promise<{ status: string; producer: boolean; consumer: boolean }> {
    return {
        status: 'ok',
        producer: producer !== null,
        consumer: consumer !== null
    };
}

// Graceful shutdown
export async function shutdown(): Promise<void> {
    isShuttingDown = true;
    console.log('Shutting down Kafka services...');

    try {
        if (consumer) {
            await consumer.disconnect();
            console.log('Consumer disconnected');
        }

        if (producer) {
            await producer.disconnect();
            console.log('Producer disconnected');
        }

        await client.$disconnect();
        console.log('Database disconnected');

    } catch (error) {
        console.error('Error during shutdown:', error);
    }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await shutdown();
    process.exit(0);
});

export default kafka;
