# BUG-003: ICE Connection Failure

## Bug Information

**Bug ID**: BUG-003  
**Title**: WebRTC ICE Connection Fails to Establish  
**Severity**: Critical  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

WebRTC peer connections frequently fail during the ICE (Interactive Connectivity Establishment) phase, especially when users are behind NAT (Network Address Translation) or corporate firewalls. The connection enters "failed" state and video calls cannot be established. This is a common WebRTC issue but needs TURN server support for reliable connectivity.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Proximity Video Call Manager | `frontend/src/services/proximityVideoCall.ts` | Frontend |
| Proximity Video Call Handler | `frontend/src/utils/ProximityVideoCallHandler.ts` | Frontend |
| RTC Configuration | Multiple files | Frontend |

---

## Reproduction Steps

1. Have User A on home network
2. Have User B on corporate network with restrictive firewall
3. Both users join the same space
4. Move within proximity range
5. Observe ICE connection state

**Expected Behavior**:  
ICE negotiation should complete and connection should reach "connected" state.

**Actual Behavior**:  
ICE connection state goes from "checking" to "failed" after timeout.

---

## Console Logs / Error Messages

```
🧊 ICE candidate added
[ICEGatheringState] user123: gathering
[ICEGatheringState] user123: complete
[ICEConnectionState] user123: checking
[ICEConnectionState] user123: failed  // ← Problem
⚠️ WebRTC connection failed
```

---

## Root Cause Analysis

### Problem

The current RTC configuration only uses STUN servers:

```typescript
private rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};
```

STUN servers only work when at least one peer has a public IP or is behind a simple NAT. When both peers are behind symmetric NAT or corporate firewalls, STUN fails and a TURN server is required.

### Technical Details

**ICE Connection Types**:
1. **Host candidates**: Direct LAN connection (works on same network)
2. **Server reflexive (srflx)**: STUN-discovered public IP (works with simple NAT)
3. **Relay candidates**: TURN relay (works through any firewall)

Without TURN, users behind restrictive networks cannot connect.

---

## Solution

### Approach

1. Add TURN server to ICE configuration
2. Implement ICE restart on failure
3. Add connection quality monitoring
4. Consider using a TURN service (Twilio, Xirsys, or self-hosted coturn)

### Code Changes

**File**: `frontend/src/services/proximityVideoCall.ts`

```typescript
// BEFORE (STUN only)
private rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

// AFTER (with TURN server)
private rtcConfig: RTCConfiguration = {
  iceServers: [
    // STUN servers (free, for simple NAT)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // TURN server (paid/self-hosted, for restrictive networks)
    {
      urls: [
        'turn:turn.yourdomain.com:3478',
        'turn:turn.yourdomain.com:3478?transport=tcp',
        'turns:turn.yourdomain.com:5349'  // TLS
      ],
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'user',
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'password'
    }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all', // 'relay' to force TURN for testing
};
```

**Add ICE Restart on Failure**:

```typescript
// In setupPeerConnectionHandlers()
peerConnection.oniceconnectionstatechange = () => {
  const state = peerConnection.iceConnectionState;
  console.log(`ICE connection state for ${userId}:`, state);
  
  if (state === 'failed') {
    console.log('🔄 ICE connection failed, attempting restart...');
    
    // Attempt ICE restart
    peerConnection.restartIce();
    
    // Create new offer with ICE restart flag
    this.restartICE(participant);
  } else if (state === 'disconnected') {
    // Give it 5 seconds to recover before restarting
    setTimeout(() => {
      if (peerConnection.iceConnectionState === 'disconnected') {
        console.log('🔄 Connection still disconnected, restarting ICE...');
        peerConnection.restartIce();
        this.restartICE(participant);
      }
    }, 5000);
  }
};

private async restartICE(participant: ProximityCallParticipant): Promise<void> {
  const { peerConnection, userId } = participant;
  
  try {
    const offer = await peerConnection.createOffer({ iceRestart: true });
    await peerConnection.setLocalDescription(offer);
    
    if (this.websocketService) {
      this.websocketService.emit('proximity-video-call-signal', {
        type: 'offer',
        callId: this.state.callId,
        fromUserId: this.currentUserId,
        targetUserId: userId,
        offer: offer
      });
    }
    
    console.log('🔄 ICE restart offer sent');
  } catch (error) {
    console.error('❌ ICE restart failed:', error);
  }
}
```

---

## TURN Server Setup Options

### Option 1: Twilio TURN (Managed, Paid)
```typescript
// Get credentials from Twilio API
const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Tokens.json', {
  method: 'POST',
  headers: { 'Authorization': 'Basic ' + btoa(accountSid + ':' + authToken) }
});
const { ice_servers } = await response.json();
// Use ice_servers in RTCConfiguration
```

### Option 2: Xirsys (Managed, Free Tier Available)
```typescript
const response = await fetch('https://global.xirsys.net/_turn/metaverse', {
  method: 'PUT',
  headers: {
    'Authorization': 'Basic ' + btoa('username:secret')
  }
});
const { v } = await response.json();
// v.iceServers contains TURN credentials
```

### Option 3: Self-hosted coturn
```bash
# Install coturn on Ubuntu
sudo apt install coturn

# /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
realm=yourdomain.com
user=metaverse:strongpassword
total-quota=100
stale-nonce
cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

---

## Testing

### Manual Testing

1. Use Chrome's `chrome://webrtc-internals` to monitor ICE candidates
2. Filter ICE candidates to see which types are discovered
3. Force TURN-only mode to test relay connectivity:
   ```typescript
   iceTransportPolicy: 'relay' // Force TURN only
   ```

### Testing Behind Restrictive Network

1. Use a VPN with strict NAT
2. Use mobile hotspot with carrier-grade NAT
3. Test from corporate network
4. Use browser extension to simulate network conditions

### Debugging ICE

```javascript
// Monitor all ICE candidates
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    const { candidate } = event;
    const type = candidate.type; // 'host', 'srflx', 'relay'
    console.log(`ICE Candidate [${type}]:`, candidate.address);
  }
};
```

---

## Cost Considerations

| Option | Cost | Reliability | Setup Effort |
|--------|------|-------------|--------------|
| STUN only | Free | ~70% success | None |
| Twilio TURN | ~$0.40/GB | 99%+ | Low |
| Xirsys | Free tier, then $5+/mo | 99%+ | Low |
| Self-hosted coturn | Server costs | 99%+ | High |

For 2,000 users with moderate video usage:
- Estimated bandwidth: 1-5 TB/month
- Twilio cost: $400-2,000/month
- Self-hosted: $50-100/month server

---

## Related Issues

- **Related Bugs**: BUG-002 (black screen can be ICE failure symptom)
- **Infrastructure**: May need to add TURN server to AWS deployment
- **Security**: TURN credentials should be short-lived tokens

---

## Notes

- Google's STUN servers have rate limits; consider using your own STUN server for production
- iOS Safari may require specific TURN configuration
- Monitor ICE connection times; if consistently slow, investigate network topology
