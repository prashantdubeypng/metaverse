# Video Call Debug Guide

## 🐛 Debugging the Proximity Video Call System

I've added comprehensive debugging to help identify why the video call window isn't showing when users get close enough. Here's what I've implemented and how to test it:

## 🔧 **Debug Features Added**

### **1. Debug Panel (Top-Left Corner)**
When you run the app, you'll see a debug panel in the top-left corner showing:
- `shouldEnable`: Whether video calls should be enabled
- `isCallActive`: Whether a video call is currently active
- `isInitialized`: Whether the video call system is initialized
- `nearbyUsers`: Number of nearby users
- `currentUser`: Current user's username
- `currentPos`: Current user's grid position

### **2. Console Logging**
I've added detailed console logging for:
- **Proximity calculation**: Shows distance calculations between users
- **Video call initialization**: Shows when the system initializes
- **Position updates**: Shows when user positions change
- **Video service events**: Shows when video calls should start/end

### **3. Fixed Distance Calculation**
The main issue was inconsistent distance calculation:
- **Space page**: Used Manhattan distance in grid coordinates
- **Video service**: Used Euclidean distance in pixels

I've fixed this by making both use the same Manhattan distance calculation.

## 🧪 **Testing Steps**

### **Step 1: Open Browser Console**
1. Open your browser's developer tools (F12)
2. Go to the Console tab
3. Look for debug messages starting with 🎯, 🎥, 📍, 🚀

### **Step 2: Test with Two Users**
1. Open two browser windows/tabs
2. Login with different users in each
3. Join the same space in both windows
4. Connect to WebSocket in both windows

### **Step 3: Move Users Close Together**
1. Use WASD keys to move users
2. Watch the debug panel for:
   - `nearbyUsers` count should increase when users get close
   - `shouldEnable` should be `true` for both users
   - `isInitialized` should be `true` for both users

### **Step 4: Check Console Logs**
Look for these specific log messages:

#### **Proximity Detection Logs:**
```
🎯 [DEBUG] Proximity calculation: {
  currentUser: { id: "...", username: "...", x: 120, y: 140 },
  allUsers: [...],
  nearbyUsers: [...],
  proximityDistance: 2,
  gridSize: 20
}
```

#### **Video Service Logs:**
```
🎥 [DEBUG] Proximity detection in video service: {
  localPosition: { x: 120, y: 140, z: 0 },
  nearbyUsers: [...],
  usersInRange: 1,
  isActive: false
}
```

#### **Video Call Start Logs:**
```
🚀 Starting proximity video call with User123 (Manhattan distance: 1 tiles)
```

## 🔍 **Common Issues & Solutions**

### **Issue 1: Video Calls Not Enabled**
**Symptoms:** `shouldEnable: false` in debug panel
**Causes:**
- User not logged in properly
- Missing user ID or username
- Not connected to WebSocket

**Solution:**
- Ensure user is logged in
- Click "Connect" button in space
- Check that `currentUser` shows in debug panel

### **Issue 2: Video System Not Initialized**
**Symptoms:** `isInitialized: false` in debug panel
**Causes:**
- WebSocket not connected
- Camera/microphone permissions denied
- JavaScript errors during initialization

**Solution:**
- Connect to WebSocket first
- Allow camera/microphone permissions when prompted
- Check browser console for errors

### **Issue 3: Users Not Detected as Nearby**
**Symptoms:** `nearbyUsers: 0` even when users are close
**Causes:**
- Users not connected to same WebSocket
- Position updates not syncing
- Distance calculation issues

**Solution:**
- Ensure both users are connected (green status)
- Move users using keyboard (WASD)
- Check console for position update logs

### **Issue 4: Video Call Not Starting**
**Symptoms:** `nearbyUsers > 0` but `isCallActive: false`
**Causes:**
- Camera/microphone access denied
- WebRTC connection issues
- JavaScript errors in video service

**Solution:**
- Check browser permissions for camera/mic
- Look for error messages in console
- Try refreshing and reconnecting

## 📊 **Expected Debug Flow**

When everything works correctly, you should see this sequence:

1. **User Login & Space Join:**
```
🚀 [DEBUG] Initializing proximity video call system
🔌 [DEBUG] Injecting WebSocket service
```

2. **User Movement:**
```
📍 [DEBUG] Position updated in video service
🎯 [DEBUG] Proximity calculation
```

3. **Users Get Close:**
```
🔄 [DEBUG] Nearby users changed
🎥 [DEBUG] Updating proximity video call system
🎥 [DEBUG] Proximity detection in video service
```

4. **Video Call Starts:**
```
🚀 Starting proximity video call with User123
```

5. **Debug Panel Updates:**
```
isCallActive: true
nearbyUsers: 1
```

## 🛠️ **Manual Testing Checklist**

- [ ] Two users can login and join the same space
- [ ] Both users can connect to WebSocket (green status)
- [ ] Debug panel shows correct user information
- [ ] Users can move with WASD keys
- [ ] Position updates appear in console
- [ ] Nearby users are detected when within 2 tiles
- [ ] Video call system initializes properly
- [ ] Camera/microphone permissions are granted
- [ ] Video call starts when users get close
- [ ] Video call window appears on screen

## 🔧 **Quick Fixes to Try**

### **Fix 1: Refresh and Reconnect**
1. Refresh both browser windows
2. Login again
3. Join the space
4. Click "Connect" button

### **Fix 2: Check Permissions**
1. Click the camera/microphone icon in browser address bar
2. Allow all permissions
3. Refresh the page

### **Fix 3: Clear Browser Data**
1. Clear browser cache and cookies
2. Restart browser
3. Try again

### **Fix 4: Use Different Browsers**
1. Try Chrome (recommended)
2. Try Firefox as backup
3. Avoid Safari for WebRTC testing

## 📞 **Expected Behavior**

When working correctly:
1. Users move within 2 tiles of each other
2. Debug panel shows `nearbyUsers: 1+`
3. Console shows video call starting
4. Small video window appears top-right
5. Both users see each other's video
6. Video window disappears when users move apart

## 🚨 **If Still Not Working**

If the video calls still don't work after following this guide:

1. **Check the console logs** - Look for any error messages
2. **Verify WebSocket connection** - Ensure both users are connected
3. **Test camera/mic separately** - Try other video call apps to ensure hardware works
4. **Check network** - Ensure no firewall blocking WebRTC
5. **Try different browsers** - Chrome usually works best for WebRTC

The debug information will help identify exactly where the issue is occurring in the video call initialization and proximity detection process.