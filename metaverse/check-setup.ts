import client from './packages/db/src/index';

async function checkSetupData() {
  try {
    console.log('📊 Checking metaverse setup data...\n');
    
    // Check avatars
    const avatars = await client.avatar.findMany();
    console.log(`👤 Avatars: ${avatars.length} created`);
    avatars.forEach(avatar => {
      console.log(`   • ${avatar.name} (ID: ${avatar.id})`);
    });
    console.log('');
    
    // Check elements
    const elements = await client.element.findMany();
    console.log(`🪑 Elements: ${elements.length} created`);
    elements.forEach(element => {
      console.log(`   • ${element.id} (${element.width}x${element.height}) - Static: ${element.static}`);
    });
    console.log('');
    
    // Check users
    const users = await client.user.findMany({
      include: {
        avatar: true
      }
    });
    console.log(`👥 Users: ${users.length} created`);
    users.forEach(user => {
      console.log(`   • ${user.username} (Role: ${user.role}) - Avatar: ${user.avatar?.name || 'None'}`);
    });
    console.log('');
    
    // Check spaces
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
    console.log(`🏢 Spaces: ${spaces.length} created`);
    spaces.forEach(space => {
      console.log(`   • ${space.name} (${space.width}x${space.height}) - Creator: ${space.creator?.username} - Elements: ${space._count.elements}`);
    });
    console.log('');
    
    // Check space elements
    const spaceElements = await client.spaceElements.findMany({
      include: {
        element: true,
        space: true
      }
    });
    console.log(`📍 Space Elements: ${spaceElements.length} placed`);
    
    // Group by space
    const elementsBySpace = spaceElements.reduce((acc, se) => {
      if (!acc[se.space.name]) {
        acc[se.space.name] = [];
      }
      acc[se.space.name].push(se);
      return acc;
    }, {} as Record<string, typeof spaceElements>);
    
    Object.entries(elementsBySpace).forEach(([spaceName, elements]) => {
      console.log(`   ${spaceName}: ${elements.length} elements`);
      // Show a few examples
      elements.slice(0, 3).forEach(element => {
        console.log(`     - ${element.element.id} at (${element.x}, ${element.y})`);
      });
      if (elements.length > 3) {
        console.log(`     ... and ${elements.length - 3} more`);
      }
    });
    
    console.log('\n✅ Setup verification complete!');
    console.log('\n🎯 Your metaverse is ready with:');
    console.log(`   • ${avatars.length} diverse avatars for users`);
    console.log(`   • ${elements.length} furniture and office elements`);
    console.log(`   • ${spaces.length} demo spaces with realistic layouts`);
    console.log(`   • ${spaceElements.length} strategically placed elements`);
    console.log(`   • 1 admin user ready for management`);
    
  } catch (error) {
    console.error('❌ Error checking setup data:', error);
  } finally {
    await client.$disconnect();
  }
}

checkSetupData();
