import client from './packages/db/src/index';

interface MenuOption {
  key: string;
  description: string;
  action: () => Promise<void>;
}

async function showAvatars() {
  console.log('\n👤 Available Avatars:');
  const avatars = await client.avatar.findMany();
  avatars.forEach((avatar, index) => {
    console.log(`${index + 1}. ${avatar.name} (ID: ${avatar.id})`);
    const imageUrl = avatar.imageurl || 'No image URL';
    console.log(`   Image: ${imageUrl.substring(0, 80)}...`);
  });
}

async function showElements() {
  console.log('\n🪑 Available Elements:');
  const elements = await client.element.findMany();
  
  // Group by type
  const office = elements.filter(e => e.id.includes('office') || e.id.includes('executive'));
  const tables = elements.filter(e => e.id.includes('table'));
  const seating = elements.filter(e => e.id.includes('sofa'));
  const electronics = elements.filter(e => e.id.includes('laptop') || e.id.includes('computer') || e.id.includes('monitor'));
  const storage = elements.filter(e => e.id.includes('bookshelf') || e.id.includes('filing'));
  const decorative = elements.filter(e => e.id.includes('plant'));
  const meeting = elements.filter(e => e.id.includes('whiteboard') || e.id.includes('projector'));
  const kitchen = elements.filter(e => e.id.includes('coffee') || e.id.includes('water'));
  
  console.log('\n  Office Chairs:');
  office.forEach(e => console.log(`    • ${e.id} (${e.width}x${e.height})`));
  
  console.log('\n  Tables:');
  tables.forEach(e => console.log(`    • ${e.id} (${e.width}x${e.height})`));
  
  console.log('\n  Seating:');
  seating.forEach(e => console.log(`    • ${e.id} (${e.width}x${e.height})`));
  
  console.log('\n  Electronics:');
  electronics.forEach(e => console.log(`    • ${e.id} (${e.width}x${e.height})`));
  
  console.log('\n  Storage:');
  storage.forEach(e => console.log(`    • ${e.id} (${e.width}x${e.height})`));
  
  console.log('\n  Decorative:');
  decorative.forEach(e => console.log(`    • ${e.id} (${e.width}x${e.height})`));
  
  console.log('\n  Meeting Room:');
  meeting.forEach(e => console.log(`    • ${e.id} (${e.width}x${e.height}) - Static: ${e.static}`));
  
  console.log('\n  Kitchen/Break Room:');
  kitchen.forEach(e => console.log(`    • ${e.id} (${e.width}x${e.height})`));
}

async function showSpaces() {
  console.log('\n🏢 Available Spaces:');
  const spaces = await client.space.findMany({
    include: {
      creator: true,
      _count: {
        select: {
          elements: true
        }
      }
    }
  });
  
  spaces.forEach((space, index) => {
    console.log(`${index + 1}. ${space.name}`);
    console.log(`   Size: ${space.width}x${space.height || 0}`);
    console.log(`   Creator: ${space.creator?.username || 'Unknown'}`);
    console.log(`   Elements: ${space._count.elements}`);
    const thumbnail = space.thumbnail || 'No thumbnail';
    console.log(`   Thumbnail: ${thumbnail.substring(0, 60)}...`);
    console.log('');
  });
}

async function showUsers() {
  console.log('\n👥 Registered Users:');
  const users = await client.user.findMany({
    include: {
      avatar: true,
      spaces: {
        select: {
          name: true
        }
      }
    }
  });
  
  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.username} (${user.role})`);
    console.log(`   Avatar: ${user.avatar?.name || 'No avatar selected'}`);
    console.log(`   Spaces created: ${user.spaces.length}`);
    if (user.spaces.length > 0) {
      console.log(`   Space names: ${user.spaces.map(s => s.name).join(', ')}`);
    }
    console.log('');
  });
}

async function showSystemStats() {
  console.log('\n📊 System Statistics:');
  
  const [avatarCount, elementCount, spaceCount, userCount, spaceElementCount] = await Promise.all([
    client.avatar.count(),
    client.element.count(),
    client.space.count(),
    client.user.count(),
    client.spaceElements.count()
  ]);
  
  console.log(`   👤 Avatars: ${avatarCount}`);
  console.log(`   🪑 Elements: ${elementCount}`);
  console.log(`   🏢 Spaces: ${spaceCount}`);
  console.log(`   👥 Users: ${userCount}`);
  console.log(`   📍 Placed Elements: ${spaceElementCount}`);
  
  // Most popular elements
  const popularElements = await client.spaceElements.groupBy({
    by: ['elementId'],
    _count: {
      elementId: true
    },
    orderBy: {
      _count: {
        elementId: 'desc'
      }
    },
    take: 5
  });
  
  console.log('\n   🔥 Most Used Elements:');
  for (const pe of popularElements) {
    const element = await client.element.findUnique({
      where: { id: pe.elementId }
    });
    console.log(`     • ${element?.id || pe.elementId}: ${pe._count.elementId} times`);
  }
  
  // User role distribution
  const adminCount = await client.user.count({ where: { role: 'Admin' } });
  const regularUserCount = await client.user.count({ where: { role: 'User' } });
  
  console.log('\n   👑 User Roles:');
  console.log(`     • Admins: ${adminCount}`);
  console.log(`     • Regular Users: ${regularUserCount}`);
}

async function runAdminDashboard() {
  console.log('🚀 Metaverse Admin Dashboard');
  console.log('==========================\\n');
  
  const menuOptions: MenuOption[] = [
    { key: '1', description: 'View Avatars', action: showAvatars },
    { key: '2', description: 'View Elements', action: showElements },
    { key: '3', description: 'View Spaces', action: showSpaces },
    { key: '4', description: 'View Users', action: showUsers },
    { key: '5', description: 'System Statistics', action: showSystemStats }
  ];
  
  // Show all by default for demo
  console.log('📋 Showing all data overview:\\n');
  
  await showSystemStats();
  await showAvatars();
  await showElements();
  await showSpaces();
  await showUsers();
  
  console.log('\\n✅ Admin dashboard data loaded!');
  console.log('\\n🎯 Your metaverse platform includes:');
  console.log('• Diverse avatar options for user personalization');
  console.log('• Comprehensive furniture and office elements');
  console.log('• Demo spaces with realistic office layouts');
  console.log('• Admin user for content management');
  console.log('• Production-ready chat and WebSocket services');
  console.log('\\n🚀 Ready for users to join and create their virtual spaces!');
}

runAdminDashboard().catch(async (error) => {
  console.error('❌ Dashboard error:', error);
  await client.$disconnect();
}).finally(async () => {
  await client.$disconnect();
});
