import { Server } from "socket.io";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { socketAuthMiddleware } from "../middleware/socketauth";
import { ConnectionManager } from "./ConnectionManager";
import { MessageManager } from "./MessageManager";

const client = new PrismaClient();

// Publisher Redis instance
const pub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
});

// Subscriber Redis instance
const sub = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
});

class SocketServer {
  private _io: Server;
  private connectionManager: ConnectionManager;
  private messageManager: MessageManager;
  private isInitialized: boolean = false;

  constructor() {
    console.log("Initializing scalable socket server with space membership support");

    this._io = new Server({
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });
    
    // Initialize managers
    this.connectionManager = new ConnectionManager(pub);
    this.messageManager = new MessageManager(pub, client);
    
    // Attach auth middleware
    this._io.use(socketAuthMiddleware);

    this.setupRedisSubscriptions();
  }

  private async setupRedisSubscriptions(): Promise<void> {
    try {
      // Subscribe to all chat channels
      await sub.subscribe(
        "chat:messages", 
        "chat:typing", 
        "chat:connections", 
        "chat:rooms",
        "chat:notifications"
      );

      console.log("Subscribed to Redis chat channels");

      // Handle Redis messages
      sub.on("message", async (channel, message) => {
        try {
          const data = JSON.parse(message);
          await this.handleRedisMessage(channel, data);
        } catch (err) {
          console.error(`Failed to process Redis message from ${channel}:`, err);
        }
      });

      // Handle Redis connection events
      pub.on('connect', () => console.log('Redis publisher connected'));
      pub.on('error', (err) => console.error('Redis publisher error:', err));
      sub.on('connect', () => console.log('Redis subscriber connected'));
      sub.on('error', (err) => console.error('Redis subscriber error:', err));

    } catch (error) {
      console.error("Failed to setup Redis subscriptions:", error);
      throw error;
    }
  }

  private async handleRedisMessage(channel: string, data: any): Promise<void> {
    switch (channel) {
      case "chat:messages":
        this._io.to(data.roomId).emit("receive-message", data);
        break;
      case "chat:typing":
        this._io.to(data.roomId).except(
          this.connectionManager.getUserSockets(data.userId)
        ).emit(data.isTyping ? "user-typing" : "user-stop-typing", {
          userId: data.userId,
          username: data.username
        });
        break;
    }
  }

  public initListeners(): void {
    if (this.isInitialized) {
      console.log("Socket listeners already initialized");
      return;
    }

    const io = this._io;
    console.log("Initializing socket listeners with space membership support");

    io.on("connection", (socket) => {
      console.log(`🔌 SOCKET CONNECTED: ${socket.id} | User: ${socket.username} (${socket.userId})`);
      
      // Add to connection manager
      this.connectionManager.addConnection(socket);

      // Create chatroom handler (for space members)
      socket.on("create-chatroom", async (data: {
        spaceId: string;
        name: string;
        description?: string;
        isPrivate: boolean;
      }) => {
        console.log(`🏗️ CREATE-CHATROOM REQUEST: User ${socket.userId} wants to create ${data.isPrivate ? 'PRIVATE' : 'PUBLIC'} chatroom in space ${data.spaceId}`);
        try {
          // Validate input
          if (!data.spaceId || !data.name) {
            socket.emit("error", { message: "Space ID and chatroom name are required" });
            return;
          }

          // Check if user is a member of the space
          const spaceMembership = await client.spaceMember.findUnique({
            where: {
              userId_spaceId: {
                userId: socket.userId!,
                spaceId: data.spaceId
              }
            },
            include: {
              space: {
                select: { name: true }
              }
            }
          });

          if (!spaceMembership) {
            console.log(`❌ Permission denied: User ${socket.userId} is not a member of space ${data.spaceId}`);
            socket.emit("error", { message: "Only space members can create chatrooms" });
            return;
          }

          console.log(`✅ Permission granted: User ${socket.userId} is a ${spaceMembership.role} of space "${spaceMembership.space.name}"`);

          // Create the chatroom
          const chatroom = await client.chatroom.create({
            data: {
              name: data.name.trim(),
              description: data.description?.trim() || null,
              isPrivate: data.isPrivate,
              spaceId: data.spaceId,
              creatorId: socket.userId!,
              createdAt: new Date()
            }
          });

          // Add creator as admin member
          await client.chatroomMember.create({
            data: {
              userId: socket.userId!,
              chatroomId: chatroom.id,
              role: 'ADMIN',
              joinedAt: new Date()
            }
          });

          console.log(`✅ ${data.isPrivate ? 'PRIVATE' : 'PUBLIC'} chatroom "${data.name}" created with ID: ${chatroom.id}`);

          // Send success response
          socket.emit("chatroom-created", {
            id: chatroom.id,
            name: chatroom.name,
            description: chatroom.description,
            isPrivate: chatroom.isPrivate,
            spaceId: chatroom.spaceId,
            createdAt: chatroom.createdAt
          });

        } catch (error) {
          console.error(`❌ Error creating chatroom for user ${socket.userId}:`, error);
          socket.emit("error", { message: "Failed to create chatroom" });
        }
      });

      // Join room handler with space membership validation
      socket.on("join-room", async (roomId: string) => {
        console.log(`🚪 JOIN-ROOM REQUEST: User ${socket.userId} wants to join room: ${roomId}`);
        try {
          // Find the chatroom with space information
          const chatroom = await client.chatroom.findFirst({
            where: { id: roomId },
            include: { space: true }
          });

          if (!chatroom) {
            socket.emit("error", { message: "Chatroom not found" });
            return;
          }

          // Check if user is a member of the space containing this chatroom
          const spaceMembership = await client.spaceMember.findUnique({
            where: {
              userId_spaceId: {
                userId: socket.userId!,
                spaceId: chatroom.spaceId
              }
            }
          });

          if (!spaceMembership) {
            console.log(`❌ Permission denied: User ${socket.userId} is not a member of space ${chatroom.spaceId}`);
            socket.emit("error", { message: "You must be a member of the space to join this chatroom" });
            return;
          }

          // For public chatrooms, auto-add user as member
          if (!chatroom.isPrivate) {
            let membership = await client.chatroomMember.findFirst({
              where: {
                userId: socket.userId,
                chatroomId: roomId,
                isActive: true
              }
            });

            if (!membership) {
              console.log(`🌍 Auto-adding space member ${socket.userId} to public room ${roomId}`);
              await client.chatroomMember.create({
                data: {
                  userId: socket.userId!,
                  chatroomId: roomId,
                  role: 'MEMBER',
                  joinedAt: new Date(),
                  isActive: true
                }
              });
            }
          } else {
            // For private chatrooms, check membership
            const membership = await client.chatroomMember.findFirst({
              where: {
                userId: socket.userId,
                chatroomId: roomId,
                isActive: true
              }
            });

            if (!membership) {
              socket.emit("error", { message: "You need permission to join this private chatroom" });
              return;
            }
          }

          // Join socket room
          socket.join(roomId);
          console.log(`✅ Socket ${socket.id} joined room ${roomId}`);

          // Update connection manager
          this.connectionManager.joinRoom(socket.id, roomId);

          // Send recent messages
          const recentMessages = await this.messageManager.getRecentMessages(roomId);
          socket.emit("recent-messages", {
            roomId,
            messages: recentMessages
          });

          // Notify others in room about new user
          socket.to(roomId).emit("user-joined", { 
            userId: socket.userId, 
            username: socket.username 
          });

          // Send success confirmation
          socket.emit("room-joined", {
            roomId,
            roomName: chatroom.name,
            memberCount: await client.chatroomMember.count({
              where: { chatroomId: roomId, isActive: true }
            })
          });

        } catch (error) {
          console.error(`❌ Error joining room ${roomId} for user ${socket.userId}:`, error);
          socket.emit("error", { message: `Failed to join chatroom` });
        }
      });

      // Enhanced message sending
      socket.on("send-message", async ({ roomId, message, type = 'text' }: { 
        roomId: string; 
        message: string; 
        type?: string;
      }) => {
        try {
          // Verify membership
          const membership = await client.chatroomMember.findFirst({
            where: {
              userId: socket.userId,
              chatroomId: roomId,
              isActive: true
            }
          });

          if (!membership) {
            socket.emit("error", { message: "You are not a member of this chatroom" });
            return;
          }

          // Create message
          const messageData = {
            roomId,
            message,
            type,
            userId: socket.userId!,
            username: socket.username!,
            timestamp: Date.now(),
            deliveryId: `msg_${Date.now()}_${socket.userId}`
          };

          // Send through message manager
          await this.messageManager.sendMessage(messageData);

          console.log(`💬 Message sent in room ${roomId} by ${socket.username}`);

        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", { 
            message: error instanceof Error ? error.message : "Failed to send message" 
          });
        }
      });

      // Typing indicators
      socket.on("typing", async ({ roomId }: { roomId: string }) => {
        await this.messageManager.handleTyping({
          userId: socket.userId!,
          username: socket.username!,
          roomId,
          isTyping: true,
          timestamp: Date.now()
        });
      });

      socket.on("stop-typing", async ({ roomId }: { roomId: string }) => {
        await this.messageManager.handleTyping({
          userId: socket.userId!,
          username: socket.username!,
          roomId,
          isTyping: false,
          timestamp: Date.now()
        });
      });

      // Leave room handler
      socket.on("leave-room", async (roomId: string) => {
        socket.leave(roomId);
        this.connectionManager.leaveRoom(socket.id, roomId);
        console.log(`Socket ${socket.id} left room ${roomId}`);
      });

      // Disconnection handling
      socket.on("disconnect", async (reason) => {
        console.log(`Socket disconnected: ${socket.id} (Reason: ${reason})`);
        this.connectionManager.removeConnection(socket.id);
      });

      // Handle errors
      socket.on("error", (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });

    this.isInitialized = true;
    console.log("✅ Socket server initialized with space membership support");
  }

  // Get server statistics
  public getServerStats(): any {
    const connectionStats = this.connectionManager.getStats();
    return {
      ...connectionStats,
      socketConnections: this._io.sockets.sockets.size,
      rooms: this._io.sockets.adapter.rooms.size,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      serviceId: process.env.SERVICE_ID || 'chat-service-1'
    };
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    console.log("Shutting down socket server...");
    this._io.close();
    await this.connectionManager.shutdown();
    await pub.disconnect();
    await sub.disconnect();
    console.log("Socket server shutdown complete");
  }

  get io() {
    return this._io;
  }
}

export default SocketServer;
