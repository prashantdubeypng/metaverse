import client from './packages/db/src/index';

async function createAvatars() {
  console.log('👤 Creating avatars...');
  
  const avatars = [
    {
      id: 'avatar-business-male',
      name: 'Business Male',
      imageurl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=business-male&accessories=eyepatch,wayfarers,round,prescription01,prescription02&accessoriesProbability=100&clothingGraphic=skull,selena&clothing=blazerShirt,blazerSweater,collarSweater,graphicShirt,hoodie,overall,shirtCrewNeck,shirtScoopNeck,shirtVNeck&top=bigHair,bob,bun,curly,curvy,dreads,frida,fro,froAndBand,longHairBigHair,longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairDreads,longHairFrida,longHairFro,longHairFroBand,longHairNotTooLong,longHairShavedSides,longHairMiaWallace,longHairStraight,longHairStraight2,longHairStraightStrand,shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggyMullet,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides,shortHairTheCaesar,shortHairTheCaesarSidePart&topProbability=100'
    },
    {
      id: 'avatar-business-female',
      name: 'Business Female',
      imageurl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=business-female&accessories=eyepatch,wayfarers,round,prescription01,prescription02&accessoriesProbability=100&clothingGraphic=skull,selena&clothing=blazerShirt,blazerSweater,collarSweater,graphicShirt,hoodie,overall,shirtCrewNeck,shirtScoopNeck,shirtVNeck&top=bigHair,bob,bun,curly,curvy,dreads,frida,fro,froAndBand,longHairBigHair,longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairDreads,longHairFrida,longHairFro,longHairFroBand,longHairNotTooLong,longHairShavedSides,longHairMiaWallace,longHairStraight,longHairStraight2,longHairStraightStrand,shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggyMullet,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides,shortHairTheCaesar,shortHairTheCaesarSidePart&topProbability=100'
    },
    {
      id: 'avatar-casual-male',
      name: 'Casual Male',
      imageurl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=casual-male&style=circle&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf'
    },
    {
      id: 'avatar-casual-female',
      name: 'Casual Female',
      imageurl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=casual-female&style=circle&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf'
    },
    {
      id: 'avatar-developer-male',
      name: 'Developer Male',
      imageurl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=developer-male&clothing=hoodie,graphicShirt&clothingGraphic=skull,selena,resist,pizza,bear,cumbia&accessories=wayfarers,round,prescription01,prescription02'
    },
    {
      id: 'avatar-developer-female',
      name: 'Developer Female',
      imageurl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=developer-female&clothing=hoodie,graphicShirt&clothingGraphic=skull,selena,resist,pizza,bear,cumbia&accessories=wayfarers,round,prescription01,prescription02'
    },
    {
      id: 'avatar-creative-male',
      name: 'Creative Male',
      imageurl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creative-male&top=longHairDreads,longHairFro,shortHairDreads01,shortHairFrizzle&clothing=overall,shirtVNeck,graphicShirt&clothingGraphic=skull,selena,resist,pizza,bear,cumbia'
    },
    {
      id: 'avatar-creative-female',
      name: 'Creative Female',
      imageurl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creative-female&top=longHairBigHair,longHairBun,longHairCurly,longHairMiaWallace&clothing=overall,shirtVNeck,graphicShirt&clothingGraphic=skull,selena,resist,pizza,bear,cumbia'
    },
    {
      id: 'avatar-gamer-male',
      name: 'Gamer Male',
      imageurl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=gamer-male&clothing=hoodie,graphicShirt&clothingGraphic=skull,pizza,bear&accessories=wayfarers,round,prescription01,prescription02&facialHair=light,luxurious,majestic,magnum,medium,goatee,full'
    },
    {
      id: 'avatar-gamer-female',
      name: 'Gamer Female',
      imageurl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=gamer-female&clothing=hoodie,graphicShirt&clothingGraphic=skull,pizza,bear&accessories=wayfarers,round,prescription01,prescription02&top=longHairStraight,longHairBun,bob'
    }
  ];

  for (const avatar of avatars) {
    try {
      await client.avatar.upsert({
        where: { id: avatar.id },
        update: avatar,
        create: avatar
      });
      console.log(`Created avatar: ${avatar.name}`);
    } catch (error) {
      console.error(`Error creating avatar ${avatar.name}:`, error);
    }
  }
}

async function createElements() {
  console.log('🪑 Creating furniture and office elements...');
  
  const elements = [
    // Office Furniture
    {
      id: 'element-office-chair',
      width: 1,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-executive-chair',
      width: 1,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1541558869434-2840d308329a?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    
    // Tables - Different Sizes
    {
      id: 'element-small-table',
      width: 2,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1549497538-303791108f95?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-medium-table',
      width: 3,
      height: 2,
      imageurl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-large-table',
      width: 4,
      height: 2,
      imageurl: 'https://images.unsplash.com/photo-1549497538-303791108f95?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-conference-table',
      width: 6,
      height: 3,
      imageurl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-round-table',
      width: 3,
      height: 3,
      imageurl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    
    // Electronics
    {
      id: 'element-laptop',
      width: 1,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-desktop-computer',
      width: 1,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-monitor',
      width: 1,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    
    // Seating
    {
      id: 'element-sofa-2seat',
      width: 3,
      height: 2,
      imageurl: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-sofa-3seat',
      width: 4,
      height: 2,
      imageurl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    
    // Storage
    {
      id: 'element-bookshelf',
      width: 2,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-filing-cabinet',
      width: 1,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    
    // Decorative
    {
      id: 'element-plant-small',
      width: 1,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-plant-large',
      width: 1,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    
    // Meeting Room Elements
    {
      id: 'element-whiteboard',
      width: 3,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=100&h=100&fit=crop&crop=center',
      static: true
    },
    {
      id: 'element-projector-screen',
      width: 4,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=100&h=100&fit=crop&crop=center',
      static: true
    },
    
    // Kitchen/Break Room
    {
      id: 'element-coffee-machine',
      width: 1,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=100&h=100&fit=crop&crop=center',
      static: false
    },
    {
      id: 'element-water-cooler',
      width: 1,
      height: 1,
      imageurl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=100&h=100&fit=crop&crop=center',
      static: false
    }
  ];

  for (const element of elements) {
    try {
      await client.element.upsert({
        where: { id: element.id },
        update: element,
        create: element
      });
      console.log(`Created element: ${element.id}`);
    } catch (error) {
      console.error(`Error creating element ${element.id}:`, error);
    }
  }
}

async function createAdminUser() {
  console.log('Creating admin user...');
  
  const adminUser = {
    id: 'admin-user',
    username: 'admin',
    password: 'admin123', // In production, this should be hashed
    role: 'Admin' as const,
    avatarId: 'avatar-business-male'
  };

  try {
    await client.user.upsert({
      where: { id: adminUser.id },
      update: adminUser,
      create: adminUser
    });
    console.log(`Created admin user: ${adminUser.username}`);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
}

async function createSpaces() {
  console.log('🏢 Creating demo spaces...');
  
  const spaces = [
    {
      id: 'space-office-demo',
      name: 'Modern Office Space',
      width: 200,
      height: 200,
      thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=400&fit=crop&crop=center',
      creatorId: 'admin-user'
    },
    {
      id: 'space-coworking-demo',
      name: 'Coworking Hub',
      width: 200,
      height: 200,
      thumbnail: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=400&fit=crop&crop=center',
      creatorId: 'admin-user'
    }
  ];

  for (const space of spaces) {
    try {
      await client.space.upsert({
        where: { id: space.id },
        update: space,
        create: space
      });
      console.log(`✅ Created space: ${space.name}`);
    } catch (error) {
      console.error(`❌ Error creating space ${space.name}:`, error);
    }
  }
}

async function populateOfficeSpace() {
  console.log('🪑 Populating Modern Office Space with furniture...');
  
  const officeElements = [
    // Reception Area
    { elementId: 'element-large-table', x: 20, y: 20 }, // Reception desk
    { elementId: 'element-executive-chair', x: 21, y: 21 },
    { elementId: 'element-sofa-3seat', x: 15, y: 25 }, // Waiting area
    { elementId: 'element-sofa-2seat', x: 15, y: 30 },
    { elementId: 'element-small-table', x: 17, y: 27 }, // Coffee table
    { elementId: 'element-plant-large', x: 25, y: 20 },
    
    // Meeting Room 1
    { elementId: 'element-conference-table', x: 50, y: 30 },
    { elementId: 'element-office-chair', x: 48, y: 31 },
    { elementId: 'element-office-chair', x: 49, y: 31 },
    { elementId: 'element-office-chair', x: 50, y: 31 },
    { elementId: 'element-office-chair', x: 51, y: 31 },
    { elementId: 'element-office-chair', x: 52, y: 31 },
    { elementId: 'element-office-chair', x: 53, y: 31 },
    { elementId: 'element-whiteboard', x: 50, y: 25 },
    { elementId: 'element-projector-screen', x: 50, y: 35 },
    
    // Open Office Area
    { elementId: 'element-medium-table', x: 80, y: 50 }, // Desk cluster 1
    { elementId: 'element-office-chair', x: 80, y: 48 },
    { elementId: 'element-office-chair', x: 82, y: 48 },
    { elementId: 'element-laptop', x: 80, y: 50 },
    { elementId: 'element-monitor', x: 82, y: 50 },
    
    { elementId: 'element-medium-table', x: 90, y: 50 }, // Desk cluster 2
    { elementId: 'element-office-chair', x: 90, y: 48 },
    { elementId: 'element-office-chair', x: 92, y: 48 },
    { elementId: 'element-desktop-computer', x: 90, y: 50 },
    { elementId: 'element-laptop', x: 92, y: 50 },
    
    { elementId: 'element-medium-table', x: 100, y: 50 }, // Desk cluster 3
    { elementId: 'element-office-chair', x: 100, y: 48 },
    { elementId: 'element-office-chair', x: 102, y: 48 },
    { elementId: 'element-monitor', x: 100, y: 50 },
    { elementId: 'element-laptop', x: 102, y: 50 },
    
    // Executive Office
    { elementId: 'element-large-table', x: 150, y: 30 }, // Executive desk
    { elementId: 'element-executive-chair', x: 150, y: 28 },
    { elementId: 'element-desktop-computer', x: 150, y: 30 },
    { elementId: 'element-monitor', x: 152, y: 30 },
    { elementId: 'element-bookshelf', x: 155, y: 25 },
    { elementId: 'element-filing-cabinet', x: 155, y: 35 },
    { elementId: 'element-plant-small', x: 148, y: 35 },
    
    // Break Room
    { elementId: 'element-round-table', x: 80, y: 120 },
    { elementId: 'element-office-chair', x: 78, y: 120 },
    { elementId: 'element-office-chair', x: 82, y: 120 },
    { elementId: 'element-office-chair', x: 80, y: 118 },
    { elementId: 'element-office-chair', x: 80, y: 122 },
    { elementId: 'element-coffee-machine', x: 85, y: 115 },
    { elementId: 'element-water-cooler', x: 85, y: 125 },
    { elementId: 'element-plant-large', x: 75, y: 115 },
    
    // Collaborative Area
    { elementId: 'element-sofa-3seat', x: 120, y: 80 },
    { elementId: 'element-sofa-2seat', x: 125, y: 85 },
    { elementId: 'element-small-table', x: 122, y: 82 },
    { elementId: 'element-plant-small', x: 130, y: 80 },
    
    // Storage Area
    { elementId: 'element-bookshelf', x: 170, y: 80 },
    { elementId: 'element-bookshelf', x: 170, y: 85 },
    { elementId: 'element-filing-cabinet', x: 175, y: 80 },
    { elementId: 'element-filing-cabinet', x: 175, y: 85 }
  ];

  for (const element of officeElements) {
    try {
      await client.spaceElements.create({
        data: {
          id: `space-office-${element.elementId}-${element.x}-${element.y}`,
          spaceId: 'space-office-demo',
          elementId: element.elementId,
          x: element.x,
          y: element.y
        }
      });
    } catch (error) {
      console.error(`❌ Error placing element ${element.elementId}:`, error);
    }
  }
  
  console.log('✅ Modern Office Space populated with furniture');
}

async function populateCoworkingSpace() {
  console.log('🏢 Populating Coworking Hub with furniture...');
  
  const coworkingElements = [
    // Hot Desks Area
    { elementId: 'element-small-table', x: 30, y: 30 },
    { elementId: 'element-office-chair', x: 30, y: 28 },
    { elementId: 'element-laptop', x: 30, y: 30 },
    
    { elementId: 'element-small-table', x: 35, y: 30 },
    { elementId: 'element-office-chair', x: 35, y: 28 },
    { elementId: 'element-laptop', x: 35, y: 30 },
    
    { elementId: 'element-small-table', x: 40, y: 30 },
    { elementId: 'element-office-chair', x: 40, y: 28 },
    { elementId: 'element-monitor', x: 40, y: 30 },
    
    { elementId: 'element-small-table', x: 30, y: 40 },
    { elementId: 'element-office-chair', x: 30, y: 38 },
    { elementId: 'element-desktop-computer', x: 30, y: 40 },
    
    { elementId: 'element-small-table', x: 35, y: 40 },
    { elementId: 'element-office-chair', x: 35, y: 38 },
    { elementId: 'element-laptop', x: 35, y: 40 },
    
    { elementId: 'element-small-table', x: 40, y: 40 },
    { elementId: 'element-office-chair', x: 40, y: 38 },
    { elementId: 'element-monitor', x: 40, y: 40 },
    
    // Dedicated Desks
    { elementId: 'element-medium-table', x: 70, y: 50 },
    { elementId: 'element-office-chair', x: 70, y: 48 },
    { elementId: 'element-desktop-computer', x: 70, y: 50 },
    { elementId: 'element-monitor', x: 72, y: 50 },
    
    { elementId: 'element-medium-table', x: 80, y: 50 },
    { elementId: 'element-executive-chair', x: 80, y: 48 },
    { elementId: 'element-laptop', x: 80, y: 50 },
    { elementId: 'element-monitor', x: 82, y: 50 },
    
    // Phone Booths / Private Calls
    { elementId: 'element-small-table', x: 120, y: 30 },
    { elementId: 'element-office-chair', x: 120, y: 28 },
    { elementId: 'element-laptop', x: 120, y: 30 },
    
    { elementId: 'element-small-table', x: 125, y: 30 },
    { elementId: 'element-office-chair', x: 125, y: 28 },
    { elementId: 'element-laptop', x: 125, y: 30 },
    
    // Meeting Rooms
    { elementId: 'element-round-table', x: 150, y: 50 },
    { elementId: 'element-office-chair', x: 148, y: 50 },
    { elementId: 'element-office-chair', x: 152, y: 50 },
    { elementId: 'element-office-chair', x: 150, y: 48 },
    { elementId: 'element-office-chair', x: 150, y: 52 },
    { elementId: 'element-whiteboard', x: 150, y: 45 },
    
    { elementId: 'element-conference-table', x: 160, y: 70 },
    { elementId: 'element-office-chair', x: 158, y: 71 },
    { elementId: 'element-office-chair', x: 159, y: 71 },
    { elementId: 'element-office-chair', x: 160, y: 71 },
    { elementId: 'element-office-chair', x: 161, y: 71 },
    { elementId: 'element-office-chair', x: 162, y: 71 },
    { elementId: 'element-office-chair', x: 163, y: 71 },
    { elementId: 'element-projector-screen', x: 160, y: 75 },
    
    // Lounge Areas
    { elementId: 'element-sofa-3seat', x: 50, y: 100 },
    { elementId: 'element-sofa-2seat', x: 55, y: 105 },
    { elementId: 'element-small-table', x: 52, y: 102 },
    { elementId: 'element-plant-large', x: 60, y: 100 },
    
    { elementId: 'element-sofa-3seat', x: 100, y: 120 },
    { elementId: 'element-sofa-2seat', x: 95, y: 125 },
    { elementId: 'element-round-table', x: 97, y: 122 },
    { elementId: 'element-plant-small', x: 105, y: 120 },
    
    // Kitchen/Pantry
    { elementId: 'element-large-table', x: 30, y: 150 }, // Kitchen counter
    { elementId: 'element-coffee-machine', x: 30, y: 150 },
    { elementId: 'element-water-cooler', x: 35, y: 150 },
    { elementId: 'element-round-table', x: 40, y: 155 }, // Dining table
    { elementId: 'element-office-chair', x: 38, y: 155 },
    { elementId: 'element-office-chair', x: 42, y: 155 },
    { elementId: 'element-office-chair', x: 40, y: 153 },
    { elementId: 'element-office-chair', x: 40, y: 157 },
    
    // Storage and Plants
    { elementId: 'element-bookshelf', x: 180, y: 150 },
    { elementId: 'element-filing-cabinet', x: 185, y: 150 },
    { elementId: 'element-plant-large', x: 20, y: 20 },
    { elementId: 'element-plant-small', x: 190, y: 20 },
    { elementId: 'element-plant-large', x: 20, y: 180 },
    { elementId: 'element-plant-small', x: 190, y: 180 }
  ];

  for (const element of coworkingElements) {
    try {
      await client.spaceElements.create({
        data: {
          id: `space-coworking-${element.elementId}-${element.x}-${element.y}`,
          spaceId: 'space-coworking-demo',
          elementId: element.elementId,
          x: element.x,
          y: element.y
        }
      });
    } catch (error) {
      console.error(`❌ Error placing element ${element.elementId}:`, error);
    }
  }
  
  console.log('✅ Coworking Hub populated with furniture');
}

async function main() {
  try {
    console.log('🚀 Starting metaverse setup...\n');
    
    // Create avatars first
    await createAvatars();
    console.log('');
    
    // Create elements
    await createElements();
    console.log('');
    
    // Create admin user
    await createAdminUser();
    console.log('');
    
    // Create spaces
    await createSpaces();
    console.log('');
    
    // Populate spaces with elements
    await populateOfficeSpace();
    console.log('');
    
    await populateCoworkingSpace();
    console.log('');
    
    console.log('🎉 Metaverse setup completed successfully!');
    console.log('\n📊 Summary:');
    console.log('• 10 unique avatars created');
    console.log('• 20 furniture and office elements created');
    console.log('• 1 admin user created (username: admin, password: admin123)');
    console.log('• 2 demo spaces created (200x200 each)');
    console.log('• Spaces populated with realistic office layouts');
    console.log('\n🎯 Next steps:');
    console.log('• Login with admin credentials');
    console.log('• Test the WebSocket service');
    console.log('• Users can now create their own spaces using the available elements');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await client.$disconnect();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Setup interrupted, disconnecting from database...');
  await client.$disconnect();
  process.exit(1);
});

// Run the setup
main().catch(async (error) => {
  console.error('💥 Unhandled error:', error);
  await client.$disconnect();
  process.exit(1);
});
