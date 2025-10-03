# Testing Guide for Proximity Video Chat System

## 🧪 Testing the Proximity Video Chat Implementation

### Prerequisites
1. **Backend Running**: Ensure the WebSocket server is running on port 3001
2. **Frontend Running**: Ensure the Next.js frontend is running on port 3000
3. **Multiple Browser Windows**: Open multiple browser windows/tabs for testing

### Test Scenarios

#### 1. **Basic Space Navigation**
- [ ] Navigate to a space from the dashboard
- [ ] Verify the space loads with the modern UI
- [ ] Check that the active users sidebar appears on the left
- [ ] Confirm the space canvas renders correctly with grid

#### 2. **WebSocket Connection**
- [ ] Click "Connect" button in the sidebar
- [ ] Verify connection status changes to "Connected"
- [ ] Check that user appears in the active users list
- [ ] Confirm position updates in real-time

#### 3. **User Movement**
- [ ] Use WASD keys to move around
- [ ] Use arrow keys to move around
- [ ] Click on the canvas to move to that position
- [ ] Verify position updates in the sidebar
- [ ] Check that movement is constrained to space boundaries

#### 4. **Multi-User Testing**
- [ ] Open multiple browser windows with different users
- [ ] Connect all users to the same space
- [ ] Verify all users appear in each other's active users sidebar
- [ ] Check real-time position updates across all windows

#### 5. **Proximity Detection**
- [ ] Move users within 2 tiles of each other
- [ ] Verify "📹 Nearby" indicator appears in sidebar
- [ ] Check proximity circles appear on canvas
- [ ] Confirm users show as green when nearby

#### 6. **Automatic Video Calls**
- [ ] Move two users within 2 tiles of each other
- [ ] Verify video call window appears automatically on the right side
- [ ] Check that both users see the video call interface
- [ ] Confirm camera and microphone permissions are requested

#### 7. **Video Call Controls**
- [ ] Test mute/unmute button functionality
- [ ] Test camera on/off button functionality
- [ ] Test end call button functionality
- [ ] Verify call duration timer works

#### 8. **Automatic Disconnection**
- [ ] Move users away from each other (>2 tiles)
- [ ] Verify video call ends automatically
- [ ] Check that video call window disappears
- [ ] Confirm "📹 Nearby" indicator disappears

#### 9. **Multiple Proximity Groups**
- [ ] Test with 3+ users in different proximity groups
- [ ] Verify separate video calls for different groups
- [ ] Check that users can switch between groups by moving

#### 10. **Error Handling**
- [ ] Test with camera/microphone denied permissions
- [ ] Test WebSocket disconnection and reconnection
- [ ] Verify error messages appear appropriately
- [ ] Check graceful degradation when video fails

### Expected Behaviors

#### ✅ **Correct Behaviors**
- Users automatically connect to video calls when within 2 tiles
- Video calls end automatically when users move apart
- Real-time position updates across all connected users
- Smooth movement with keyboard and mouse controls
- Modern UI with active users sidebar and proximity indicators
- Compact video call window positioned on the right side
- WebRTC signaling works through existing WebSocket infrastructure

#### ❌ **Issues to Watch For**
- Infinite re-render loops (should be fixed)
- Video calls not starting automatically
- Position updates not syncing across users
- WebSocket connection failures
- Camera/microphone permission issues
- UI elements overlapping or not responsive

### Performance Testing

#### **Load Testing**
- [ ] Test with 5+ users in the same space
- [ ] Verify performance remains smooth
- [ ] Check memory usage doesn't grow excessively
- [ ] Monitor WebSocket message frequency

#### **Network Testing**
- [ ] Test with slow network connections
- [ ] Verify graceful handling of network interruptions
- [ ] Check video quality adaptation

### Browser Compatibility

#### **Desktop Browsers**
- [ ] Chrome (recommended)
- [ ] Firefox
- [ ] Safari
- [ ] Edge

#### **Mobile Browsers** (if applicable)
- [ ] Chrome Mobile
- [ ] Safari Mobile
- [ ] Firefox Mobile

### Debugging Tips

#### **Console Logs**
Check browser console for:
- WebSocket connection messages
- Video call initialization logs
- Position update messages
- Error messages

#### **Network Tab**
Monitor:
- WebSocket connection status
- Message frequency and size
- Failed requests

#### **Common Issues & Solutions**

1. **Video Call Not Starting**
   - Check camera/microphone permissions
   - Verify WebSocket connection is active
   - Ensure users are within 2-tile distance

2. **Position Not Updating**
   - Check WebSocket connection status
   - Verify user is connected to live session
   - Check for JavaScript errors in console

3. **UI Not Responsive**
   - Check for infinite re-render loops in console
   - Verify React component state management
   - Check CSS conflicts

4. **WebSocket Connection Issues**
   - Verify backend server is running on correct port
   - Check firewall/network restrictions
   - Ensure JWT token is valid

### Test Data

#### **Test Users**
Create multiple test accounts with different usernames:
- TestUser1
- TestUser2
- TestUser3

#### **Test Spaces**
Create test spaces with different dimensions:
- Small space: 400x400 pixels
- Medium space: 800x600 pixels
- Large space: 1200x800 pixels

### Success Criteria

The implementation is successful if:
- ✅ Users can move around the space smoothly
- ✅ Proximity detection works within 2-tile distance
- ✅ Video calls start and end automatically based on proximity
- ✅ Multiple users can interact simultaneously
- ✅ UI is responsive and modern
- ✅ WebSocket integration works reliably
- ✅ No infinite re-render loops or performance issues

### Reporting Issues

When reporting issues, include:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Console error messages
5. Network tab information
6. Screenshots/videos if applicable