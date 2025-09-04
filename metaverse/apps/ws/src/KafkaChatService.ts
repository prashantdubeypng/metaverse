import 'dotenv/config';
import { Kafka, Producer, Consumer } from 'kafkajs';
import fs from 'fs';
// New: Import Prisma Client
import client from '@repo/db';

// New: Initialize Prisma Client. 
// It's often better to manage this instance in a separate file (e.g., /lib/prisma.ts)
// and import it, but for simplicity, we'll instantiate it here.

export class KafkaChatService {
    private kafka: Kafka;
    private producer: Producer | null = null;
    private consumer: Consumer | null = null;
    private static instance: KafkaChatService;

    private constructor() {
        // ... (The entire constructor remains the same)
        const kafkaConfig: any = {
            clientId: 'websocket-chat-service',
            brokers: [process.env.KAFKA_BROKER || 'kafka-636a702-metaverse-33456.c.aivencloud.com:18243'],
            retry: {
                initialRetryTime: 1000,
                retries: 5,
                maxRetryTime: 30000,
                factor: 2
            },
            connectionTimeout: 10000,
            requestTimeout: 30000
        };

        const path = require('path');
        const caPemPath = path.join(__dirname, '..', 'ca.pem');
        const isAivenCloud = process.env.KAFKA_BROKER?.includes('aivencloud.com');

        if (fs.existsSync(caPemPath)) {
            console.log(' Found ca.pem certificate, configuring Kafka with SSL');
            kafkaConfig.ssl = {
                rejectUnauthorized: process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== 'false',
                ca: [fs.readFileSync(caPemPath, 'utf-8')]
            };
        } else if (process.env.KAFKA_SSL_CA) {
            console.log(' Using SSL certificates from environment variables');
            kafkaConfig.ssl = {
                rejectUnauthorized: process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== 'false',
                ca: [fs.readFileSync(process.env.KAFKA_SSL_CA, 'utf-8')]
            };
        } else if (isAivenCloud) {
            console.log(' Aiven Cloud detected, enabling SSL without custom certificates');
            kafkaConfig.ssl = { rejectUnauthorized: true };
        } else {
            console.log('ℹ️ No SSL certificates found, using plain Kafka connection');
        }

        if (kafkaConfig.ssl && process.env.KAFKA_SSL_CERT && process.env.KAFKA_SSL_KEY) {
            kafkaConfig.ssl.cert = fs.readFileSync(process.env.KAFKA_SSL_CERT, 'utf-8');
            kafkaConfig.ssl.key = fs.readFileSync(process.env.KAFKA_SSL_KEY, 'utf-8');
            console.log(' Added client certificate and key');
        }

        if (process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD) {
            console.log('Configuring Kafka with SASL authentication');
            kafkaConfig.sasl = {
                mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
                username: process.env.KAFKA_USERNAME,
                password: process.env.KAFKA_PASSWORD
            };
        }

        console.log(' Kafka configuration:', {
            clientId: kafkaConfig.clientId,
            brokers: kafkaConfig.brokers,
            ssl: !!kafkaConfig.ssl,
            sasl: !!kafkaConfig.sasl
        });

        this.kafka = new Kafka(kafkaConfig);
    }

    public static getInstance(): KafkaChatService {
        if (!this.instance) {
            this.instance = new KafkaChatService();
        }
        return this.instance;
    }

    public async connect(): Promise<void> {
        // ... (This method remains the same)
        try {
            this.producer = this.kafka.producer({
                maxInFlightRequests: 1,
                idempotent: true,
                transactionTimeout: 30000,
                allowAutoTopicCreation: true
            });
            await this.producer.connect();
            console.log(' Kafka Producer connected for chat service');

            this.consumer = this.kafka.consumer({
                groupId: 'websocket-chat-group',
                sessionTimeout: 30000,
                heartbeatInterval: 3000
            });
            await this.consumer.connect();
            console.log(' Kafka Consumer connected for chat service');

        } catch (error) {
            console.error(' Failed to connect to Kafka:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        // ... (This method remains the same)
        try {
            if (this.consumer) {
                await this.consumer.disconnect();
                console.log('🔌 Kafka Consumer disconnected');
            }
            if (this.producer) {
                await this.producer.disconnect();
                console.log('🔌 Kafka Producer disconnected');
            }
        } catch (error) {
            console.error(' Error disconnecting from Kafka:', error);
        }
    }

    // ---
    // Modified: This method now saves to the database first
    // ---
    public async sendChatMessage(messageData: {
        messageId: string;
        content: string;
        userId: string;
        username: string;
        chatroomId: string;
        type?: string;
        timestamp?: number;
    }): Promise<void> {
        // 1. Save message to the database
        try {
            console.log(` [DB] Attempting to save message ${messageData.messageId} to chatroom ${messageData.chatroomId}`);

            await client.message.create({
                data: {
                    id: messageData.messageId, // Use the pre-generated ID
                    content: messageData.content,
                    userId: messageData.userId,
                    chatroomId: messageData.chatroomId,
                    type: messageData.type || 'text',
                    status: 'sent', // Default status
                    createdAt: new Date(messageData.timestamp || Date.now()),
                    sentAt: new Date(messageData.timestamp || Date.now())
                }
            });

            console.log(`[DB] Successfully saved message ${messageData.messageId}`);

        } catch (error) {
            console.error('Failed to save chat message to database:', error);
            // If the database write fails, we should not proceed to send it to Kafka
            // to avoid inconsistent state (message appears in real-time but is not saved).
            throw new Error('Database write failed for chat message.');
        }

        // 2. Send message to Kafka for real-time distribution and other consumers
        try {
            if (!this.producer) {
                console.warn('Kafka producer not connected - skipping message broadcast');
                return;
            }

            const message = {
                messageId: messageData.messageId,
                content: messageData.content,
                userId: messageData.userId,
                username: messageData.username,
                chatroomId: messageData.chatroomId,
                type: messageData.type || 'text',
                timestamp: messageData.timestamp || Date.now(),
                source: 'websocket'
            };

            await this.producer.send({
                topic: 'chatmessage',
                messages: [{
                    key: messageData.chatroomId,
                    value: JSON.stringify(message),
                    timestamp: message.timestamp.toString(),
                    headers: {
                        'message-type': 'chat',
                        'chatroom-id': messageData.chatroomId,
                        'user-id': messageData.userId
                    }
                }]
            });

            console.log(`[KAFKA] Sent chat message to topic: chatmessage, chatroom: ${messageData.chatroomId}`);

        } catch (error) {
            console.error(' Failed to send chat message to Kafka:', error);
            // Note: At this point, the message is in the DB but failed to broadcast.
            // A more advanced system might have a retry mechanism or a cleanup job.
            throw error;
        }
    }

    // ... (The rest of the methods: sendUserEvent, sendAnalytics, etc. remain the same)
    public async sendUserEvent(eventData: {
        eventType: 'join' | 'leave';
        userId: string;
        username: string;
        chatroomId: string;
        timestamp?: number;
    }): Promise<void> {
        try {
            if (!this.producer) {
                console.warn('Kafka producer not connected - skipping user event');
                return;
            }

            const event = {
                ...eventData,
                timestamp: eventData.timestamp || Date.now(),
                source: 'websocket'
            };

            await this.producer.send({
                topic: 'user-events',
                messages: [{
                    key: eventData.userId,
                    value: JSON.stringify(event),
                    timestamp: event.timestamp.toString(),
                    headers: {
                        'event-type': eventData.eventType,
                        'chatroom-id': eventData.chatroomId,
                        'user-id': eventData.userId
                    }
                }]
            });

            console.log(`[KAFKA] Sent user event: ${eventData.eventType}, user: ${eventData.username}, chatroom: ${eventData.chatroomId}`);

        } catch (error) {
            console.error('Failed to send user event to Kafka:', error);
            throw error;
        }
    }

    public async sendAnalytics(analyticsData: {
        type: 'message_sent' | 'user_joined' | 'user_left' | 'chatroom_activity';
        chatroomId: string;
        userId?: string;
        metadata?: any;
        timestamp?: number;
    }): Promise<void> {
        try {
            if (!this.producer) {
                console.warn('Kafka producer not connected - skipping analytics');
                return;
            }

            const analytics = {
                ...analyticsData,
                timestamp: analyticsData.timestamp || Date.now(),
                source: 'websocket'
            };

            await this.producer.send({
                topic: 'chat-analytics',
                messages: [{
                    key: analyticsData.chatroomId,
                    value: JSON.stringify(analytics),
                    timestamp: analytics.timestamp.toString(),
                    headers: {
                        'analytics-type': analyticsData.type,
                        'chatroom-id': analyticsData.chatroomId
                    }
                }]
            });

            console.log(`[KAFKA] Sent analytics: ${analyticsData.type}, chatroom: ${analyticsData.chatroomId}`);

        } catch (error) {
            console.error(' Failed to send analytics to Kafka:', error);
        }
    }

    // Batch send multiple messages (for high throughput)
    public async sendBatchMessages(messages: Array<{
        topic: string;
        key: string;
        value: any;
        headers?: Record<string, string>;
    }>): Promise<void> {
        try {
            if (!this.producer) {
                console.warn(' Kafka producer not connected - skipping batch messages');
                return;
            }

            // Group messages by topic
            const topicBatches: Record<string, any[]> = {};

            messages.forEach(({ topic, key, value, headers }) => {
                if (!topicBatches[topic]) {
                    topicBatches[topic] = [];
                }
                topicBatches[topic].push({
                    key,
                    value: JSON.stringify(value),
                    timestamp: Date.now().toString(),
                    headers: headers || {}
                });
            });

            // Send all batches
            await Promise.all(
                Object.entries(topicBatches).map(([topic, batch]) =>
                    this.producer!.send({ topic, messages: batch })
                )
            );

            console.log(` [KAFKA BATCH] Sent ${messages.length} messages across ${Object.keys(topicBatches).length} topics`);

        } catch (error) {
            console.error(' Failed to send batch messages to Kafka:', error);
            throw error;
        }
    }

    // Health check
    public async healthCheck(): Promise<{
        status: string;
        producer: boolean;
        consumer: boolean;
    }> {
        return {
            status: 'ok',
            producer: this.producer !== null,
            consumer: this.consumer !== null
        };
    }
}