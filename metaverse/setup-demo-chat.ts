import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupDemoData() {
  try {
    console.log('🚀 Setting up demo data for chat system...');

    // Create demo space if it doesn't exist
    const demoSpace = await prisma.space.upsert({
      where: { id: 'demo-space-001' },
      update: {},
      create: {
        id: 'demo-space-001',
        name: 'Demo Chat Space',
        width: 800,
        height: 600,
        thumbnail: 'https://via.placeholder.com/200x150?text=Demo+Space',
        creatorId: 'demo-user'
      }
    });

    console.log('✅ Demo space created:', demoSpace.name);

    // Create demo user if it doesn't exist
    const demoUser = await prisma.user.upsert({
      where: { id: 'demo-user' },
      update: {},
      create: {
        id: 'demo-user',
        username: 'DemoUser',
        password: 'demo123', // In production, this would be hashed
        role: 'User'
      }
    });

    console.log('✅ Demo user created:', demoUser.username);

    // Create some demo chatrooms
    const demoChatrooms = [
      {
        id: 'demo-room',
        name: 'General Demo Room',
        description: 'A general chat room for testing'
      },
      {
        id: 'debug-room',
        name: 'Debug Room',
        description: 'Room for debugging and testing features'
      },
      {
        id: 'production-demo',
        name: 'Production Demo',
        description: 'Showcase of production chat features'
      }
    ];

    for (const roomData of demoChatrooms) {
      const chatroom = await prisma.chatroom.upsert({
        where: { id: roomData.id },
        update: {},
        create: {
          id: roomData.id,
          name: roomData.name,
          description: roomData.description,
          isPrivate: false,
          spaceId: demoSpace.id,
          creatorId: demoUser.id
        }
      });

      console.log(`✅ Demo chatroom created: ${chatroom.name}`);

      // Add demo user as owner of the chatroom
      await prisma.chatroomMember.upsert({
        where: { 
          userId_chatroomId: {
            userId: demoUser.id,
            chatroomId: chatroom.id
          }
        },
        update: {},
        create: {
          userId: demoUser.id,
          chatroomId: chatroom.id,
          role: 'OWNER',
          joinedAt: new Date(),
          isActive: true
        }
      });

      console.log(`👤 Demo user added as owner of ${chatroom.name}`);
    }

    console.log('🎉 Demo data setup completed successfully!');
    console.log('');
    console.log('Available demo rooms:');
    demoChatrooms.forEach(room => {
      console.log(`  📁 ${room.id} - ${room.name}`);
    });

  } catch (error) {
    console.error('❌ Error setting up demo data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupDemoData();
