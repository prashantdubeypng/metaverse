import { VideoCallSystem } from './VideoCallSystem.js';

/**
 * Simple test to verify video call system integration
 * Run this to test that everything is working correctly
 */

async function testVideoCallSystem() {
  console.log('🧪 Testing Video Call System Integration...');
  
  try {
    // Create video call system
    const videoCallSystem = new VideoCallSystem();
    console.log('✅ VideoCallSystem created successfully');
    
    // Mock WebSocket for testing
    const mockWebSocket = {
      emit: (event: string, data: any) => {
        console.log(`📤 WebSocket emit: ${event}`, data);
      },
      on: (event: string, handler: Function) => {
        console.log(`📥 WebSocket listener registered: ${event}`);
      }
    };
    
    // Initialize system
    await videoCallSystem.initialize('test-user-123', mockWebSocket);
    console.log('✅ Video call system initialized');
    
    // Test position update
    videoCallSystem.updatePosition(10, 5, 0);
    console.log('✅ Position updated successfully');
    
    // Get system status
    const status = videoCallSystem.getStatus();
    console.log('✅ System status:', {
      isInitialized: status.isInitialized,
      nearbyUsersCount: status.nearbyUsersCount,
      currentPosition: status.currentPosition
    });
    
    // Test cleanup
    videoCallSystem.destroy();
    console.log('✅ System cleaned up successfully');
    
    console.log('🎉 All tests passed! Video call system is ready for integration.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in your application
export { testVideoCallSystem };

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testVideoCallSystem();
}