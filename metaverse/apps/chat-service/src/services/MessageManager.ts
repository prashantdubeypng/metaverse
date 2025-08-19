import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { producermessage } from '@metaverse/kafka-service';

interface MessagePayload {
  id?: string;
  roomId: string;
  message: string;
  userId: string;
  username: string;
  timestamp: number;
  messageType?: 'text' | 'system' | 'notification';
}

interface TypingPayload {
  userId: string;
  username: string;
  roomId: string;
  isTyping: boolean;
  timestamp: number;
}

export class MessageManager {
  private redis: Redis;
  private client: PrismaClient;
  private readonly MESSAGE_CACHE_TTL = 3600; // 1 hour
  private readonly RECENT_MESSAGES_LIMIT = 50;

  constructor(redis: Redis, prisma: PrismaClient) {
    this.redis = redis;
    this.client = prisma;
  }

  // Send a message
  async sendMessage(payload: MessagePayload): Promise<MessagePayload> {
    try {
      // Validate message
      if (!payload.message || payload.message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      if (payload.message.length > 2000) {
        throw new Error('Message too long (max 2000 characters)');
      }

      // Save to database
      const savedMessage = await this.client.message.create({
        data: {
          content: payload.message.trim(),
          userId: payload.userId,
          chatroomId: payload.roomId
        },
        include: {
          user: {
            select: { id: true, username: true }
          }
        }
      });

      // Create enhanced payload
      const enhancedPayload: MessagePayload = {
        id: savedMessage.id,
        roomId: payload.roomId,
        message: savedMessage.content,
        userId: savedMessage.user.id,
        username: savedMessage.user.username,
        timestamp: savedMessage.createdAt.getTime(),
        messageType: payload.messageType || 'text'
      };

      // Cache message
      await this.cacheMessage(enhancedPayload);

      // Publish to Redis for real-time distribution
      await this.redis.publish('chat:messages', JSON.stringify(enhancedPayload));

      // Send to Kafka for analytics and persistence backup
      await this.sendToKafka(enhancedPayload);

      return enhancedPayload;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Get recent messages for a room
  async getRecentMessages(roomId: string, limit: number = this.RECENT_MESSAGES_LIMIT): Promise<MessagePayload[]> {
    try {
      // First try to get from cache
      const cached = await this.getCachedMessages(roomId, limit);
      if (cached.length > 0) {
        return cached;
      }

      // Fallback to database
      const messages = await this.client.message.findMany({
        where: { chatroomId: roomId },
        include: {
          user: {
            select: { id: true, username: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      const messagePayloads = messages.reverse().map(msg => ({
        id: msg.id,
        roomId: msg.chatroomId,
        message: msg.content,
        userId: msg.user.id,
        username: msg.user.username,
        timestamp: msg.createdAt.getTime(),
        messageType: 'text' as const
      }));

      // Cache the messages
      await this.cacheRoomMessages(roomId, messagePayloads);

      return messagePayloads;
    } catch (error) {
      console.error('Error getting recent messages:', error);
      throw error;
    }
  }

  // Handle typing indicators
  async handleTyping(payload: TypingPayload): Promise<void> {
    try {
      const typingKey = `typing:${payload.roomId}:${payload.userId}`;
      
      if (payload.isTyping) {
        // Set typing indicator with TTL
        await this.redis.setex(typingKey, 10, JSON.stringify({
          userId: payload.userId,
          username: payload.username,
          timestamp: payload.timestamp
        }));
      } else {
        // Remove typing indicator
        await this.redis.del(typingKey);
      }

      // Publish typing event
      await this.redis.publish('chat:typing', JSON.stringify(payload));
    } catch (error) {
      console.error('Error handling typing:', error);
    }
  }

  // Get active typers in a room
  async getActiveTypers(roomId: string): Promise<{ userId: string; username: string }[]> {
    try {
      const pattern = `typing:${roomId}:*`;
      const keys = await this.redis.keys(pattern);
      
      const typers = await Promise.all(
        keys.map(async (key) => {
          const data = await this.redis.get(key);
          return data ? JSON.parse(data) : null;
        })
      );

      return typers.filter(Boolean);
    } catch (error) {
      console.error('Error getting active typers:', error);
      return [];
    }
  }

  // Cache a single message
  private async cacheMessage(message: MessagePayload): Promise<void> {
    try {
      const cacheKey = `messages:${message.roomId}`;
      await this.redis.lpush(cacheKey, JSON.stringify(message));
      await this.redis.ltrim(cacheKey, 0, this.RECENT_MESSAGES_LIMIT - 1);
      await this.redis.expire(cacheKey, this.MESSAGE_CACHE_TTL);
    } catch (error) {
      console.error('Error caching message:', error);
    }
  }

  // Cache room messages
  private async cacheRoomMessages(roomId: string, messages: MessagePayload[]): Promise<void> {
    try {
      const cacheKey = `messages:${roomId}`;
      const pipeline = this.redis.pipeline();
      
      // Clear existing cache
      pipeline.del(cacheKey);
      
      // Add messages in reverse order (most recent first in cache)
      messages.reverse().forEach(message => {
        pipeline.lpush(cacheKey, JSON.stringify(message));
      });
      
      pipeline.expire(cacheKey, this.MESSAGE_CACHE_TTL);
      await pipeline.exec();
    } catch (error) {
      console.error('Error caching room messages:', error);
    }
  }

  // Get cached messages
  private async getCachedMessages(roomId: string, limit: number): Promise<MessagePayload[]> {
    try {
      const cacheKey = `messages:${roomId}`;
      const cached = await this.redis.lrange(cacheKey, 0, limit - 1);
      
      return cached.map(item => JSON.parse(item)).reverse(); // Reverse to get chronological order
    } catch (error) {
      console.error('Error getting cached messages:', error);
      return [];
    }
  }

  // Send to Kafka for analytics
  private async sendToKafka(payload: MessagePayload): Promise<void> {
    try {
      await producermessage(JSON.stringify({
        type: 'chat_message',
        data: {
          messageId: payload.id,
          content: payload.message,
          userId: payload.userId,
          username: payload.username,
          chatroomId: payload.roomId,
          timestamp: payload.timestamp,
          messageType: payload.messageType || 'text'
        },
        metadata: {
          service: 'chat-service',
          version: '1.0',
          timestamp: Date.now()
        }
      }));
    } catch (error) {
      console.error('Error sending to Kafka:', error);
      // Don't throw here - Kafka failures shouldn't break message sending
    }
  }

  // System message helpers
  async sendSystemMessage(roomId: string, message: string): Promise<void> {
    const systemPayload: MessagePayload = {
      roomId,
      message,
      userId: 'system',
      username: 'System',
      timestamp: Date.now(),
      messageType: 'system'
    };

    await this.redis.publish('chat:messages', JSON.stringify(systemPayload));
  }

  // Notification message helpers
  async sendNotification(roomId: string, message: string, targetUserId?: string): Promise<void> {
    const notificationPayload: MessagePayload = {
      roomId,
      message,
      userId: 'notification',
      username: 'Notification',
      timestamp: Date.now(),
      messageType: 'notification'
    };

    if (targetUserId) {
      // Send to specific user
      await this.redis.publish(`chat:notifications:${targetUserId}`, JSON.stringify(notificationPayload));
    } else {
      // Send to room
      await this.redis.publish('chat:messages', JSON.stringify(notificationPayload));
    }
  }

  // Message analytics
  async getMessageStats(roomId: string, fromTimestamp?: number): Promise<{
    totalMessages: number;
    activeUsers: number;
    messagesPerHour: number;
  }> {
    try {
      const where: any = { chatroomId: roomId };
      if (fromTimestamp) {
        where.createdAt = { gte: new Date(fromTimestamp) };
      }

      const totalMessages = await this.client.message.count({ where });
      
      const uniqueUsers = await this.client.message.findMany({
        where,
        select: { userId: true },
        distinct: ['userId']
      });

      const activeUsers = uniqueUsers.length;
      
      // Calculate messages per hour (rough estimate)
      const timeRange = fromTimestamp ? Date.now() - fromTimestamp : 24 * 60 * 60 * 1000; // Default 24 hours
      const hours = timeRange / (60 * 60 * 1000);
      const messagesPerHour = hours > 0 ? totalMessages / hours : 0;

      return {
        totalMessages,
        activeUsers,
        messagesPerHour
      };
    } catch (error) {
      console.error('Error getting message stats:', error);
      return { totalMessages: 0, activeUsers: 0, messagesPerHour: 0 };
    }
  }

  // Cleanup old cached messages
  async cleanupCache(): Promise<void> {
    try {
      const pattern = 'messages:*';
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // Key has no expiration, set it
          await this.redis.expire(key, this.MESSAGE_CACHE_TTL);
        }
      }
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }
}
