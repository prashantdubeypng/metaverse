// Simple test script to send a message to Kafka and verify it gets saved
import { producermessage } from './dist/index.js';

const testMessage = {
    messageId: `test_${Date.now()}`,
    content: 'Test message from Kafka service',
    userId: 'test-user-id',
    username: 'TestUser',
    chatroomId: 'test-chatroom-id',
    type: 'text',
    timestamp: Date.now()
};

console.log('🧪 [TEST] Sending test message to Kafka...');
console.log('📝 [TEST] Message:', JSON.stringify(testMessage, null, 2));

try {
    await producermessage(JSON.stringify(testMessage), 'message');
    console.log('✅ [TEST] Message sent successfully to topic: message');
    console.log('⏳ [TEST] Check the consumer logs to see if it gets processed...');
} catch (error) {
    console.error('❌ [TEST] Failed to send message:', error);
}

// Keep the process alive for a bit to see consumer logs
setTimeout(() => {
    console.log('🏁 [TEST] Test completed');
    process.exit(0);
}, 5000);