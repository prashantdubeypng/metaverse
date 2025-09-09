# Implementation Plan

- [x] 1. Set up core infrastructure and data models


  - Create TypeScript interfaces for Position3D, UserPosition, MeetingRoom, MeetingRoomSession, CallSession, and SignalingMessage
  - Implement basic data validation functions for all models including meeting room coordinate validation
  - Set up project structure with separate modules for proximity, meeting rooms, peer-to-peer calling, and dual-mode WebRTC
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [ ] 2. Implement meeting room detection system
- [ ] 2.1 Create meeting room coordinate system
  - Write meeting room definition and coordinate boundary detection
  - Implement meeting room registry with spatial indexing for room lookup
  - Create unit tests for meeting room boundary detection and overlap handling
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2.2 Build MeetingRoomManager client component
  - Implement meeting room detection based on user position
  - Create meeting room join/leave logic with participant management
  - Write event handlers for room availability and participant changes
  - Add unit tests for meeting room manager functionality
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2.3 Develop server-side MeetingRoomService
  - Implement meeting room creation and management with participant tracking
  - Create room-based message broadcasting and state synchronization
  - Add WebSocket event handlers for room join/leave and participant updates
  - Write integration tests for meeting room service with multiple participants
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [ ] 3. Implement proximity detection for peer-to-peer calls
- [x] 3.1 Create spatial indexing for user positions outside meeting rooms


  - Write 3D spatial hash grid implementation for efficient proximity queries with fixed 10-unit range
  - Implement distance calculation functions with meeting room exclusion logic and 10-unit threshold
  - Create unit tests for spatial indexing accuracy with 10-unit range validation and meeting room filtering
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3.2 Build ProximityManager client component for peer-to-peer discovery



  - Implement position tracking with fixed 10-unit range detection excluding meeting room participants
  - Create nearby users list management with real-time updates and room status filtering
  - Write event handlers for 10-unit proximity changes and availability status
  - Add unit tests for proximity manager with 10-unit range validation and meeting room integration
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3.3 Develop server-side ProximityService with meeting room awareness
  - Implement user position storage and retrieval using spatial index with room exclusions and 10-unit range
  - Create proximity calculation service with fixed 10-unit threshold that respects meeting room boundaries
  - Add WebSocket event handlers for position updates and filtered proximity broadcasts with 10-unit validation
  - Write integration tests for proximity service with 10-unit range and meeting room interactions
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [ ] 4. Build peer-to-peer call request management system
- [ ] 4.1 Implement CallManager client component for peer-to-peer calls


  - Create peer-to-peer call initiation logic with target user validation and meeting room status check
  - Implement incoming call notification handling with accept/reject options for peer-to-peer requests
  - Add call request timeout and expiration mechanisms with meeting room priority handling
  - Write unit tests for peer-to-peer call request lifecycle management
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4.2 Develop CallSignalingService on server for dual-mode calls
  - Implement peer-to-peer call request routing and validation between users outside meeting rooms
  - Create call state management with proper status tracking for both call types
  - Add call cleanup and resource management for expired/ended calls in both modes
  - Write integration tests for call signaling between multiple clients with meeting room interactions
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 5. Implement dual-mode WebRTC connection handling
- [ ] 5.1 Create WebRTCHandler client component for both call modes
  - Implement peer-to-peer connection creation with STUN/TURN configuration
  - Add meeting room multi-party connection handling with SFU/mesh topology support
  - Create SDP offer/answer exchange handling for both direct and mediated connections
  - Write unit tests for WebRTC connection establishment flow in both modes
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [ ] 5.2 Add dual-mode media stream management
  - Implement local media stream capture with audio/video constraints for both call types
  - Create remote stream handling for single peer (P2P) and multiple participants (meeting room)
  - Add media device permission handling with error recovery for both contexts
  - Write tests for media stream lifecycle in peer-to-peer and meeting room scenarios
  - _Requirements: 4.2, 4.3, 4.6, 4.7_

- [ ] 5.3 Implement connection quality monitoring for both modes
  - Add WebRTC stats monitoring for connection health in peer-to-peer and meeting room calls
  - Create automatic reconnection logic with exponential backoff for both call types
  - Implement adaptive video quality based on network conditions with multi-party considerations
  - Write tests for connection failure recovery and quality adaptation in both modes
  - _Requirements: 4.5, 4.7_



- [ ] 6. Build user interface components for dual-mode calls
- [ ] 6.1 Create meeting room and proximity detection UI
  - Implement meeting room detection notification with participant preview and join option
  - Create nearby users sidebar component for peer-to-peer calls (excluding meeting room participants)
  - Add click handlers for initiating peer-to-peer video calls with meeting room status validation
  - Write component tests for meeting room detection and peer-to-peer user interaction
  - _Requirements: 1.2, 1.4, 1.6, 2.1, 2.2_

- [ ] 6.2 Implement context-aware notification system
  - Create incoming peer-to-peer call notification UI with accept/reject buttons
  - Add meeting room join notifications with participant list preview
  - Implement notification prioritization (meeting room over peer-to-peer) and queuing
  - Write tests for notification display and user interaction in both contexts
  - _Requirements: 3.2, 6.1, 6.2, 6.6, 6.7_

- [ ] 6.3 Build adaptive video call interface
  - Create peer-to-peer video call window with two-person layout
  - Implement meeting room video interface with responsive grid layout for multiple participants
  - Add adaptive call controls (leave vs end call) based on call mode
  - Write tests for both call interface types and mode-specific functionality
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 7. Implement privacy and security features for dual-mode calls
- [ ] 7.1 Add user availability and privacy controls for both call modes
  - Create user status management (available/unavailable/do-not-disturb) affecting both proximity and meeting room auto-join
  - Implement user blocking functionality that prevents peer-to-peer calls and excludes from shared meeting rooms
  - Add privacy settings for proximity visibility and meeting room participation consent
  - Write tests for privacy controls and user blocking in both call contexts
  - _Requirements: 7.1, 7.3, 7.7_

- [ ] 7.2 Implement security measures for dual-mode system
  - Add rate limiting for peer-to-peer call requests and meeting room join attempts per user
  - Create call history logging with metadata only (no content) for both call types
  - Implement proper WebRTC connection encryption validation for peer-to-peer and meeting room calls
  - Write security tests for rate limiting and data protection in both modes
  - _Requirements: 7.2, 7.4, 7.5, 7.6_

- [ ] 8. Add error handling and recovery for dual-mode system
- [ ] 8.1 Implement comprehensive error handling for both call modes
  - Create error handling for media device access failures in peer-to-peer and meeting room contexts
  - Add network error recovery with user-friendly messages specific to call mode
  - Implement fallback mechanisms for connection failures (P2P to audio-only, meeting room participant removal)
  - Write tests for various error scenarios and recovery paths in both call types
  - _Requirements: 4.5, 4.6, 6.3_

- [ ] 8.2 Add logging and monitoring for dual-mode calls
  - Implement client-side error logging and reporting for both call modes
  - Create server-side call analytics and monitoring with meeting room and peer-to-peer metrics
  - Add performance metrics collection for optimization of both call types
  - Write tests for logging functionality and data accuracy across both modes
  - _Requirements: 7.4_

- [ ] 9. Integration and end-to-end testing for dual-mode system
- [ ] 9.1 Create integration tests for complete dual-mode call flows
  - Write tests for meeting room detection, join, and multi-party call completion
  - Test peer-to-peer proximity detection to call completion with meeting room exclusions
  - Add browser compatibility tests for WebRTC functionality in both call modes
  - Create performance tests for proximity calculations and meeting room management with many users
  - _Requirements: All requirements integration_

- [ ] 9.2 Implement final system integration for dual-mode calls
  - Integrate dual-mode video call feature with existing metaverse client
  - Add configuration management for STUN/TURN servers and SFU endpoints
  - Create deployment scripts and environment setup for both call modes
  - Write documentation for feature configuration, meeting room setup, and usage
  - _Requirements: System integration_