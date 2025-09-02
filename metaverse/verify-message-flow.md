# Message Flow Verification Guide

## Current Configuration
- **Kafka Topic**: `message` ✅
- **WebSocket Service**: Sends to `message` topic ✅  
- **Kafka Consumer**: Listens to `message` topic ✅
- **Database**: Saves to `Message` table ✅

## Steps to Verify Messages are Being Saved

### 1. Start the Kafka Consumer Service
```bash
cd metaverse/apps/kafka-service
npm run build
npm start
```

You should see:
```
🚀 [KAFKA SERVICE] Starting Kafka consumer service...
✅ Kafka Consumer connected for chat service
📡 [KAFKA SERVICE] Listening for messages on topics: message, chat-messages, chat-analytics, user-events
```

### 2. Start the WebSocket Service
```bash
cd metaverse/apps/ws
npm run dev
```

### 3. Send a Test Message
Use your frontend or a WebSocket client to send a chat message:

```json
{
  "type": "chat-message",
  "payload": {
    "chatroomId": "your-chatroom-id",
    "content": "Hello, this is a test message!",
    "type": "text"
  }
}
```

### 4. Check the Logs

**Kafka Consumer Logs should show:**
```
📨 [KAFKA] Received message from topic: message, partition: 0
💬 [KAFKA] Processing chat message...
📥 [KAFKA] Received chat message: { messageId: "...", content: "...", ... }
✅ [DATABASE] Chat message saved: msg_1234567890_abc123
✅ [KAFKA] Message processed successfully from topic message
```

### 5. Verify in Database
Check your PostgreSQL database:
```sql
SELECT * FROM "Message" ORDER BY "createdAt" DESC LIMIT 5;
```

## Troubleshooting

### If messages aren't being saved:

1. **Check Kafka Consumer is Running**
   - Look for "Kafka consumer connected" message
   - Ensure no connection errors

2. **Check WebSocket Logs**
   - Look for "📤 [KAFKA] Sent chat message to topic: message"
   - Ensure no Kafka producer errors

3. **Check Database Connection**
   - Verify DATABASE_URL in both services
   - Check database is running and accessible

4. **Check Message Structure**
   - Ensure messageId, content, userId, chatroomId are present
   - Check for validation errors in consumer logs

## Test Script
Run the test script to send a message directly:
```bash
cd metaverse/apps/kafka-service
node test-message.js
```