// Script to check existing Kafka topics
import { Kafka } from 'kafkajs';
import 'dotenv/config';

const kafka = new Kafka({
    clientId: 'topic-checker',
    brokers: [process.env.KAFKA_BROKER],
    ssl: {
        rejectUnauthorized: true
    },
    sasl: {
        mechanism: 'plain',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD
    }
});

async function checkTopics() {
    const admin = kafka.admin();
    
    try {
        await admin.connect();
        console.log('✅ Connected to Kafka');
        
        const topics = await admin.listTopics();
        console.log('📋 Available topics:', topics);
        
        if (!topics.includes('chatmessage')) {
            console.log('❌ Topic "chatmessage" does not exist');
            console.log('🔧 Creating topic "chatmessage"...');
            
            await admin.createTopics({
                topics: [{
                    topic: 'chatmessage',
                    numPartitions: 3,
                    replicationFactor: 1
                }]
            });
            
            console.log('✅ Topic "chatmessage" created successfully');
        } else {
            console.log('✅ Topic "chatmessage" already exists');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await admin.disconnect();
    }
}

checkTopics();