# Bug Documentation

This directory contains detailed documentation of all known bugs in the Metaverse application, along with their root causes, impacts, and solutions.

## Target Scale
- **Current Capacity**: ~500-1,000 concurrent users
- **Target Capacity**: 2,000 concurrent users

## Bug Categories

| Category | Count | Critical | Major | Minor |
|----------|-------|----------|-------|-------|
| Video Calling | 9 | 3 | 5 | 1 |
| Movement & Position | 7 | 2 | 4 | 1 |
| WebSocket Connection | 6 | 3 | 2 | 1 |
| User Presence | 5 | 1 | 3 | 1 |
| Chat System | 3 | 0 | 2 | 1 |
| Performance | 4 | 1 | 2 | 1 |
| Scalability | 1 | 1 | 0 | 0 |
| **Total** | **35** | **11** | **18** | **6** |

## Quick Navigation

### Video Calling Bugs
1. [BUG-001: Proximity Video Call Not Triggering](./video-calling/BUG-001-proximity-call-not-triggering.md)
2. [BUG-002: Video Stream Black Screen](./video-calling/BUG-002-video-stream-black-screen.md)
3. [BUG-003: ICE Connection Failure](./video-calling/BUG-003-ice-connection-failure.md)
4. [BUG-004: Multiple Peer Connections Leaking](./video-calling/BUG-004-peer-connection-leak.md)
5. [BUG-005: Audio Echo in Video Calls](./video-calling/BUG-005-audio-echo.md)
6. [BUG-006: Video Call Not Ending Properly](./video-calling/BUG-006-call-not-ending.md)
7. [BUG-007: Remote Stream Not Displaying](./video-calling/BUG-007-remote-stream-not-displaying.md)
8. [BUG-008: Screen Share Not Working](./video-calling/BUG-008-screen-share-not-working.md)
9. [BUG-028: Audio Echo in Video Calls](./video-calling/BUG-028-audio-echo.md)

### Movement & Position Bugs
1. [BUG-009: Avatar Teleporting to Wrong Position](./movement/BUG-009-avatar-teleporting.md)
2. [BUG-010: Movement Rejected Incorrectly](./movement/BUG-010-movement-rejected.md)
3. [BUG-011: Coordinate System Mismatch](./movement/BUG-011-coordinate-system-mismatch.md)
4. [BUG-012: Avatar Stuck at Boundaries](./movement/BUG-012-avatar-stuck-boundaries.md)
5. [BUG-013: Keyboard Controls Not Responding](./movement/BUG-013-keyboard-controls.md)
6. [BUG-014: Position Desync Between Users](./movement/BUG-014-position-desync.md)
7. [BUG-030: Keyboard Controls Stop Working](./movement/BUG-030-keyboard-controls-stop-working.md)

### WebSocket Connection Bugs
1. [BUG-015: WebSocket Disconnection Loop](./websocket/BUG-015-disconnection-loop.md)
2. [BUG-016: Message Queue Overflow](./websocket/BUG-016-message-queue-overflow.md)
3. [BUG-017: Authentication Race Condition](./websocket/BUG-017-auth-race-condition.md)
4. [BUG-018: Heartbeat Timeout](./websocket/BUG-018-heartbeat-timeout.md)
5. [BUG-019: Reconnection State Loss](./websocket/BUG-019-reconnection-state-loss.md)
6. [BUG-032: Connection Lost to Room Users After Page Refresh](./websocket/BUG-032-connection-lost-on-refresh.md)

### User Presence Bugs
1. [BUG-020: Users Not Visible After Reconnect](./presence/BUG-020-users-not-visible.md)
2. [BUG-021: Ghost Users in Space](./presence/BUG-021-ghost-users.md)
3. [BUG-022: Duplicate User Entries](./presence/BUG-022-duplicate-users.md)
4. [BUG-023: User Count Mismatch](./presence/BUG-023-user-count-mismatch.md)
5. [BUG-029: Stale Position After Reconnect](./presence/BUG-029-stale-position-after-reconnect.md)

### Chat System Bugs
1. [BUG-024: Messages Not Delivered](./chat/BUG-024-messages-not-delivered.md)
2. [BUG-025: Chat History Not Loading](./chat/BUG-025-chat-history.md)
3. [BUG-026: Chatroom Join Race Condition](./chat/BUG-026-chatroom-join-race.md)

### Performance Bugs
1. [BUG-027: Memory Leak on Long Sessions](./performance/BUG-027-memory-leak.md)
2. [BUG-028: High CPU Usage During Movement](./performance/BUG-028-high-cpu-movement.md)
3. [BUG-029: Slow Initial Load](./performance/BUG-029-slow-initial-load.md)
4. [BUG-030: Event Listener Accumulation](./performance/BUG-030-event-listener-accumulation.md)

### Scalability Bugs
1. [BUG-031: Room State Not Synchronized Across Servers](./scalability/BUG-031-room-state-not-synced.md)

## Priority Matrix

### Critical (Fix Immediately)
These bugs completely break core functionality:
- BUG-001: Proximity video call not triggering
- BUG-009: Avatar teleporting (coordinate bug)
- BUG-011: Coordinate system mismatch (grid vs pixel)
- BUG-015: WebSocket disconnection loop
- BUG-017: Authentication race condition
- BUG-020: Users not visible after reconnect
- BUG-032: Connection lost on page refresh ⚠️ NEW
- BUG-003: ICE connection failure
- BUG-004: Peer connection leak
- BUG-027: Memory leak
- BUG-031: Room state not synchronized across servers
- BUG-031: Room state not synchronized (scalability)

### Major (Fix This Sprint)
These bugs significantly impact user experience:
- BUG-002: Video stream black screen
- BUG-005: Audio echo
- BUG-006: Call not ending properly
- BUG-007: Remote stream not displaying
- BUG-010: Movement rejected incorrectly
- BUG-012: Avatar stuck at boundaries
- BUG-014: Position desync
- BUG-016: Message queue overflow
- BUG-018: Heartbeat timeout
- BUG-021: Ghost users
- BUG-022: Duplicate users
- BUG-024: Messages not delivered
- BUG-025: Chat history not loading
- BUG-028: Audio echo / High CPU during movement
- BUG-029: Stale position after reconnect
- BUG-030: Keyboard controls stop working / Event listener accumulation

### Minor (Backlog)
These bugs are cosmetic or have workarounds:
- BUG-008: Screen share not working
- BUG-013: Keyboard controls edge cases
- BUG-019: Reconnection state loss
- BUG-023: User count mismatch
- BUG-026: Chatroom join race
- BUG-029: Slow initial load

## How to Use This Documentation

1. **Finding a Bug**: Use the category-based navigation or search by bug ID
2. **Reporting a New Bug**: Create a new file following the template in `./templates/bug-template.md`
3. **Fixing a Bug**: Follow the solution steps, then update the status in the bug file
4. **Testing a Fix**: Use the reproduction steps to verify the fix works

## Bug File Template

Each bug file contains:
- **Bug ID**: Unique identifier
- **Title**: Brief description
- **Severity**: Critical/Major/Minor
- **Status**: Open/In Progress/Fixed/Verified
- **Affected Components**: Which files/services are involved
- **Reproduction Steps**: How to reproduce the bug
- **Root Cause**: Why the bug occurs
- **Solution**: How to fix it
- **Testing**: How to verify the fix
- **Related Bugs**: Links to related issues
