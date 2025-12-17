# Quick Video Call Test Guide

## 🚀 **Testing the Proximity Video Call System**

I've fixed the main issues with the video call system and added comprehensive debugging. Here's how to test it:

## ✅ **What I Fixed**

### **1. Distance Calculation Mismatch**
- **Problem**: Space page and video service used different distance calculations
- **Solution**: Both now use Manhattan distance in grid coordinates
- **Result**: Consistent proximity detection across the system

### **2. Added Debug Information**
- **Debug panel** in top-left corner shows real-time status
- **Console logging** for all proximity and video call events
- **Position tracking** to verify user movement synchronization

### **3. Improved Error Handling**
- Better WebSocket service injection
- Proper initialization guards
- Enhanced logging for troubleshooting

## 🧪 **Step-by-Step Test**

### **Step 1: Start the Servers**
```bash
# Terminal 1 - Backend WebSocket
cd metaverse/apps/ws
npm run dev

# Terminal 2 - Frontend
cd frontend  
npm run dev
```

### **Step 2: Open Two Browser Windows**
1. Open `http://localhost:3000` in two different browser windows
2. Login with different user accounts in each window
3. Join the same space from the dashboard

### **Step 3: Connect to WebSocket**
1. In both windows, click the "Connect" button in the yellow banner
2. Verify status changes to "Connected" (green)
3. Check that users appear in each other's "Active Users" sidebar

### **Step 4: Test Proximity Detection**
1. **Watch the debug panel** in the top-left corner of each window
2. Use **WASD keys** to move users around
3. **Get within 2 tiles** of each other (you'll see green "📹 Nearby" badges)
4. **Check console logs** for proximity detection messages

### **Step 5: Verify Video Call**
When users are within 2 tiles:
- Debug panel should show `isCallActive: true`
- Small video window should appear in top-right corner
- Browser should request camera/microphone permissions
- Both users should see each other's video feeds

## 🔍 **Debug Information**

### **Debug Panel (Top-Left)**
```
Video Calls Debug:
shouldEnable: true
isCallActive: true  ← This should be true when users are close
isInitialized: true
nearbyUsers: 1      ← This should be > 0 when users are close
currentUser: TestUser1
currentPos: (5, 7)
```

### **Console Logs to Watch For**
```
🎯 [DEBUG] Proximity calculation: { nearbyUsers: [...] }
🎥 [DEBUG] Updating proximity video call system
📍 [DEBUG] Position updated in video service
🚀 Starting proximity video call with User123
```

## 🎮 **Controls**

### **Movement**
- **W/↑**: Move up
- **S/↓**: Move down  
- **A/←**: Move left
- **D/→**: Move right
- **Mouse Click**: Click on canvas to move to that position

### **Video Call Controls**
- **Mute/Unmute**: Toggle microphone
- **Camera On/Off**: Toggle video
- **End Call**: Manually end the call

## 🚨 **Troubleshooting**

### **If Video Window Doesn't Appear**

#### **Check Debug Panel:**
- `shouldEnable: false` → User not logged in properly or missing data
- `isInitialized: false` → Video system failed to initialize
- `nearbyUsers: 0` → Users not detected as nearby
- `isCallActive: false` → Video call not starting despite proximity

#### **Check Console:**
- Look for error messages in red
- Verify proximity detection logs appear
- Check for WebRTC initialization errors
- Ensure position updates are being logged

#### **Check Permissions:**
- Browser should prompt for camera/microphone access
- Click "Allow" for both camera and microphone
- Check browser address bar for permission icons

#### **Check Connection:**
- Both users must have green "Connected" status
- Users must appear in each other's "Active Users" sidebar
- WebSocket connection must be stable

### **Common Solutions**

1. **Refresh Both Windows** - Clear any cached state
2. **Allow Permissions** - Grant camera/microphone access
3. **Use Chrome** - Best WebRTC compatibility
4. **Check Network** - Ensure no firewall blocking WebRTC
5. **Move Closer** - Ensure users are actually within 2 tiles (40 pixels)

## 📊 **Expected Behavior**

### **When Working Correctly:**
1. Users move within 2 tiles of each other
2. Debug panel shows `nearbyUsers: 1+`
3. Console shows "🚀 Starting proximity video call"
4. Video window appears in top-right corner
5. Both users see each other's video
6. Video window disappears when users move apart

### **Visual Indicators:**
- **Green circles** around nearby users on the canvas
- **"📹 Nearby" badges** in the Active Users sidebar
- **Proximity indicator** in the space header
- **Video call window** with live video feeds

## 🎯 **Success Criteria**

The video call system is working if:
- ✅ Debug panel shows correct status information
- ✅ Users are detected as nearby when within 2 tiles
- ✅ Video call window appears automatically
- ✅ Camera/microphone permissions are granted
- ✅ Video feeds are visible in both windows
- ✅ Calls end automatically when users move apart

The comprehensive debugging I've added will help you identify exactly where any issues occur in the video call process. The system should now work reliably with the fixed distance calculations and improved error handling.