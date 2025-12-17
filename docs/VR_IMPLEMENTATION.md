# VR Implementation Guide for MetaSpace

**12-week roadmap to ship VR support for Meta Quest, PSVR, SteamVR**

---

## 🎯 Quick Decision: Native vs WebXR

### Option A: Native VR (Recommended) 
**Build with Unity/Unreal** → Best performance, full device access, app store distribution

**Pros**:
- 90-120 FPS (no motion sickness)
- Full controller/hand tracking support
- Haptic feedback
- App store presence (Quest Store, SteamVR)

**Cons**:
- Longer development time (12 weeks)
- Need C#/C++ developers (or learn Unity)
- Separate codebase from web

### Option B: WebXR (Faster MVP)
**Build with Three.js/Babylon.js** → Works in browser, faster iteration

**Pros**:
- Share code with web version
- Deploy instantly (no app store review)
- Easier debugging

**Cons**:
- Lower performance (45-60 FPS)
- Limited device access
- Browser compatibility issues

**Recommendation**: Start with **Native Unity** for long-term success. WebXR is good for prototyping only.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      VR Client (Unity)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ VR Rendering │  │  Input       │  │  Audio       │     │
│  │ (XR Toolkit) │  │  (6DoF)      │  │  (Spatial)   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                            │                                │
│                ┌───────────▼──────────────┐                 │
│                │  Network Layer           │                 │
│                │  - WebRTC Data Channels  │                 │
│                │  - WebSocket Fallback    │                 │
│                │  - Position Sync (10Hz)  │                 │
│                │  - Voice (Opus 48kHz)    │                 │
│                └───────────┬──────────────┘                 │
└────────────────────────────┼────────────────────────────────┘
                             │
                ┌────────────▼────────────┐
                │   Backend (Existing)    │
                │  - WebSocket Server     │
                │  - Redis (Shared State) │
                │  - TURN Servers         │
                │  - Postgres             │
                └─────────────────────────┘
```

---

## 📦 Tech Stack

### VR Client
- **Unity 2022.3 LTS** - Stable, best VR support
- **XR Interaction Toolkit** - Unity's official VR framework
- **Mirror Networking** - Open-source multiplayer (works with WebSocket)
- **Oculus Integration SDK** - Quest-specific features
- **SteamVR Plugin** - PC VR support

### Networking
- **WebRTC** - P2P voice + low-latency data channels
- **WebSocket** - Fallback for position sync
- **Protocol Buffers** - Compact binary format (10x smaller than JSON)

### Audio
- **Oculus Spatializer** - HRTF audio for Quest
- **Steam Audio** - Cross-platform spatial audio
- **Opus Codec** - Voice compression (48kHz → 32 kbps)

---

## 🗓️ 12-Week Implementation Plan

### Phase 1: Foundation (Weeks 1-3)

#### Week 1: Unity Project Setup

**Create new Unity project**:
```bash
# Install Unity Hub
# Download Unity 2022.3.x LTS
# Create new 3D (URP) project: "MetaSpace-VR"
```

**Install packages** (Unity Package Manager):
- XR Interaction Toolkit (2.5.0+)
- XR Plugin Management
- Oculus XR Plugin
- OpenXR Plugin
- Mirror Networking (Asset Store - Free)

**Project structure**:
```
MetaSpace-VR/
├── Assets/
│   ├── Scenes/
│   │   └── OfficeSpace.unity
│   ├── Scripts/
│   │   ├── Networking/
│   │   ├── Player/
│   │   ├── Audio/
│   │   └── UI/
│   ├── Prefabs/
│   │   ├── VRPlayer.prefab
│   │   └── RemotePlayer.prefab
│   ├── Materials/
│   └── Models/
└── Packages/
```

#### Week 2: VR Player Setup

**Create VR rig** (`Assets/Scripts/Player/VRPlayerController.cs`):
```csharp
using UnityEngine;
using UnityEngine.XR;
using UnityEngine.XR.Interaction.Toolkit;

public class VRPlayerController : MonoBehaviour
{
    [Header("XR Components")]
    public XROrigin xrOrigin;
    public ActionBasedController leftController;
    public ActionBasedController rightController;
    public Camera vrCamera;
    
    [Header("Movement")]
    public float moveSpeed = 2f;
    public float turnSpeed = 45f;
    
    private Vector2 moveInput;
    private Vector2 turnInput;
    
    void Start()
    {
        // Subscribe to controller inputs
        leftController.activateActionValue.action.performed += ctx => OnTriggerPressed(true);
        rightController.activateActionValue.action.performed += ctx => OnTriggerPressed(false);
    }
    
    void Update()
    {
        // Get thumbstick input
        leftController.translateAnchorAction.action.ReadValue<Vector2>(out moveInput);
        rightController.rotateAnchorAction.action.ReadValue<Vector2>(out turnInput);
        
        HandleMovement();
        HandleRotation();
        SendPositionUpdate();
    }
    
    void HandleMovement()
    {
        // Move relative to headset forward direction
        Vector3 forward = vrCamera.transform.forward;
        forward.y = 0; // Keep on ground plane
        forward.Normalize();
        
        Vector3 right = vrCamera.transform.right;
        right.y = 0;
        right.Normalize();
        
        Vector3 movement = (forward * moveInput.y + right * moveInput.x) * moveSpeed * Time.deltaTime;
        transform.position += movement;
    }
    
    void HandleRotation()
    {
        // Snap turn (comfort feature to reduce motion sickness)
        if (Mathf.Abs(turnInput.x) > 0.5f)
        {
            transform.Rotate(0, turnInput.x * turnSpeed * Time.deltaTime, 0);
        }
    }
    
    void SendPositionUpdate()
    {
        // Send position to server (10 Hz)
        if (Time.frameCount % 6 == 0) // 60 FPS / 6 = 10 Hz
        {
            NetworkManager.Instance.SendPosition(
                transform.position.x,
                transform.position.z,
                vrCamera.transform.rotation
            );
        }
    }
    
    void OnTriggerPressed(bool isLeftHand)
    {
        // Interact with objects
        Debug.Log($"Trigger pressed: {(isLeftHand ? "Left" : "Right")} hand");
    }
}
```

**Create VR rig prefab**:
```
VRPlayer (root)
├── XR Origin
│   ├── Camera Offset
│   │   └── Main Camera (vrCamera)
│   ├── Left Controller
│   │   ├── Hand Model (3D mesh)
│   │   └── Ray Interactor
│   └── Right Controller
│       ├── Hand Model (3D mesh)
│       └── Ray Interactor
└── VRPlayerController (script)
```

#### Week 3: Network Integration

**Connect to existing WebSocket server** (`Assets/Scripts/Networking/NetworkManager.cs`):
```csharp
using UnityEngine;
using System;
using System.Collections.Generic;
using NativeWebSocket; // Unity WebSocket library

public class NetworkManager : MonoBehaviour
{
    public static NetworkManager Instance { get; private set; }
    
    private WebSocket websocket;
    private string serverUrl = "ws://localhost:3001"; // Your existing WS server
    
    // Remote players
    private Dictionary<string, RemotePlayer> remotePlayers = new Dictionary<string, RemotePlayer>();
    public GameObject remotePlayerPrefab;
    
    async void Start()
    {
        Instance = this;
        
        websocket = new WebSocket(serverUrl);
        
        websocket.OnOpen += () => {
            Debug.Log("✅ Connected to server");
            JoinSpace();
        };
        
        websocket.OnMessage += (bytes) => {
            string message = System.Text.Encoding.UTF8.GetString(bytes);
            HandleMessage(message);
        };
        
        websocket.OnError += (error) => {
            Debug.LogError($"WebSocket Error: {error}");
        };
        
        websocket.OnClose += (code) => {
            Debug.Log($"Disconnected: {code}");
        };
        
        await websocket.Connect();
    }
    
    void Update()
    {
        #if !UNITY_WEBGL || UNITY_EDITOR
        websocket?.DispatchMessageQueue();
        #endif
    }
    
    void JoinSpace()
    {
        // Send join message (matches your existing protocol)
        var joinMessage = new {
            type = "join",
            payload = new {
                spaceId = "office-1",
                userId = SystemInfo.deviceUniqueIdentifier,
                x = 5,
                y = 5,
                name = "VR Player",
                avatar = "default"
            }
        };
        
        string json = JsonUtility.ToJson(joinMessage);
        websocket.SendText(json);
    }
    
    public void SendPosition(float x, float z, Quaternion rotation)
    {
        var posMessage = new {
            type = "move",
            payload = new {
                x = Mathf.RoundToInt(x / 0.2f), // Convert to grid coords (20px = 0.2 unity units)
                y = Mathf.RoundToInt(z / 0.2f),
                rotation = rotation.eulerAngles.y
            }
        };
        
        string json = JsonUtility.ToJson(posMessage);
        websocket.SendText(json);
    }
    
    void HandleMessage(string json)
    {
        // Parse message (matches your existing protocol)
        var data = JsonUtility.FromJson<WebSocketMessage>(json);
        
        switch (data.type)
        {
            case "user-joined":
                OnUserJoined(data.payload);
                break;
            case "user-moved":
                OnUserMoved(data.payload);
                break;
            case "user-left":
                OnUserLeft(data.payload);
                break;
        }
    }
    
    void OnUserJoined(UserData user)
    {
        if (!remotePlayers.ContainsKey(user.userId))
        {
            GameObject playerObj = Instantiate(remotePlayerPrefab);
            RemotePlayer remote = playerObj.GetComponent<RemotePlayer>();
            remote.Initialize(user);
            remotePlayers[user.userId] = remote;
        }
    }
    
    void OnUserMoved(MoveData move)
    {
        if (remotePlayers.TryGetValue(move.userId, out RemotePlayer remote))
        {
            remote.SetTargetPosition(move.x * 0.2f, move.y * 0.2f);
        }
    }
    
    void OnUserLeft(string userId)
    {
        if (remotePlayers.TryGetValue(userId, out RemotePlayer remote))
        {
            Destroy(remote.gameObject);
            remotePlayers.Remove(userId);
        }
    }
}

[Serializable]
public class WebSocketMessage
{
    public string type;
    public object payload;
}
```

---

### Phase 2: Networking (Weeks 4-6)

#### Week 4: WebRTC Integration for Voice

**Install WebRTC for Unity**:
- Download: https://github.com/Unity-Technologies/com.unity.webrtc
- Add to project via Package Manager

**Voice chat manager** (`Assets/Scripts/Audio/VoiceManager.cs`):
```csharp
using Unity.WebRTC;
using UnityEngine;
using System.Collections.Generic;

public class VoiceManager : MonoBehaviour
{
    private RTCPeerConnection peerConnection;
    private MediaStream localStream;
    private Dictionary<string, AudioSource> remoteAudioSources = new Dictionary<string, AudioSource>();
    
    void Start()
    {
        StartCoroutine(WebRTC.Update());
        InitializeLocalAudio();
    }
    
    void InitializeLocalAudio()
    {
        // Capture microphone
        localStream = Audio.CaptureStream();
        Debug.Log("🎤 Microphone captured");
    }
    
    public async void CreatePeerConnection(string remoteUserId)
    {
        var configuration = new RTCConfiguration
        {
            iceServers = new[]
            {
                new RTCIceServer { urls = new[] { "stun:stun.l.google.com:19302" } }
            }
        };
        
        peerConnection = new RTCPeerConnection(ref configuration);
        
        // Add local audio track
        foreach (var track in localStream.GetAudioTracks())
        {
            peerConnection.AddTrack(track, localStream);
        }
        
        // Handle incoming audio
        peerConnection.OnTrack = (RTCTrackEvent e) =>
        {
            if (e.Track is AudioStreamTrack audioTrack)
            {
                CreateRemoteAudioSource(remoteUserId, audioTrack);
            }
        };
        
        // Create offer
        var offer = await peerConnection.CreateOffer();
        await peerConnection.SetLocalDescription(ref offer);
        
        // Send offer to remote peer via WebSocket
        NetworkManager.Instance.SendSignal(remoteUserId, "offer", offer.sdp);
    }
    
    void CreateRemoteAudioSource(string userId, AudioStreamTrack track)
    {
        GameObject audioObj = new GameObject($"RemoteAudio-{userId}");
        AudioSource audioSource = audioObj.AddComponent<AudioSource>();
        audioSource.spatialBlend = 1.0f; // Full 3D
        audioSource.minDistance = 1f;
        audioSource.maxDistance = 10f;
        audioSource.rolloffMode = AudioRolloffMode.Linear;
        
        // Attach audio track
        audioSource.SetTrack(track);
        audioSource.loop = true;
        audioSource.Play();
        
        remoteAudioSources[userId] = audioSource;
        
        // Position audio at remote player location
        if (NetworkManager.Instance.GetRemotePlayer(userId, out RemotePlayer remote))
        {
            audioObj.transform.SetParent(remote.transform);
            audioObj.transform.localPosition = Vector3.zero;
        }
    }
    
    void OnDestroy()
    {
        peerConnection?.Close();
        localStream?.Dispose();
    }
}
```

#### Week 5: Spatial Audio

**Integrate Oculus Spatializer**:
```csharp
// Add to each remote audio source
AudioSource audioSource = audioObj.AddComponent<AudioSource>();
audioSource.spatialBlend = 1.0f;

// Enable Oculus Spatializer
audioSource.spatialize = true;
audioSource.spatializePostEffects = true;

// Configure attenuation
ONSPAudioSource osp = audioObj.AddComponent<ONSPAudioSource>();
osp.EnableSpatialization = true;
osp.ReflectionEngine = true; // Room reflections
osp.Near = 1f; // Start attenuating at 1 meter
osp.Far = 10f; // Silent beyond 10 meters
```

#### Week 6: Optimization

**Protocol Buffers for position sync** (10x smaller than JSON):

Install `protobuf-net` NuGet package in Unity

Define message schema (`position.proto`):
```protobuf
syntax = "proto3";

message PositionUpdate {
  string user_id = 1;
  float x = 2;
  float y = 3;
  float rotation = 4;
  int64 timestamp = 5;
}
```

Generate C# code:
```bash
protoc --csharp_out=. position.proto
```

Use in Unity:
```csharp
// Serialize
var update = new PositionUpdate {
    UserId = userId,
    X = x,
    Y = y,
    Rotation = rotation,
    Timestamp = DateTimeOffset.Now.ToUnixTimeMilliseconds()
};

byte[] bytes = Serialize(update);
websocket.Send(bytes); // Binary WebSocket

// 12 bytes vs 120 bytes JSON - 10x smaller!
```

---

### Phase 3: UX & Polish (Weeks 7-9)

#### Week 7: Movement Comfort

**Teleportation system** (reduces motion sickness):
```csharp
public class TeleportController : MonoBehaviour
{
    public LineRenderer teleportLine;
    public GameObject teleportMarker;
    
    void Update()
    {
        if (rightController.selectAction.action.ReadValue<float>() > 0.5f)
        {
            ShowTeleportArc();
        }
        else if (rightController.selectAction.action.WasReleasedThisFrame())
        {
            ExecuteTeleport();
        }
    }
    
    void ShowTeleportArc()
    {
        // Physics-based arc (parabola)
        Vector3 velocity = rightController.transform.forward * 5f;
        List<Vector3> points = new List<Vector3>();
        
        Vector3 pos = rightController.transform.position;
        for (int i = 0; i < 30; i++)
        {
            points.Add(pos);
            velocity += Physics.gravity * 0.05f;
            pos += velocity * 0.05f;
            
            // Check ground collision
            if (Physics.Raycast(pos, Vector3.down, out RaycastHit hit, 0.5f))
            {
                teleportMarker.transform.position = hit.point;
                teleportMarker.SetActive(true);
                break;
            }
        }
        
        teleportLine.positionCount = points.Count;
        teleportLine.SetPositions(points.ToArray());
    }
    
    void ExecuteTeleport()
    {
        if (teleportMarker.activeSelf)
        {
            xrOrigin.transform.position = teleportMarker.transform.position;
            teleportMarker.SetActive(false);
        }
        teleportLine.positionCount = 0;
    }
}
```

#### Week 8: Avatar Eye Contact

**Make avatars look at each other**:
```csharp
public class AvatarHeadController : MonoBehaviour
{
    public Transform head;
    public Transform eyes;
    private Transform targetPlayer;
    
    void Update()
    {
        // Find closest player
        targetPlayer = FindClosestPlayer();
        
        if (targetPlayer != null && Vector3.Distance(transform.position, targetPlayer.position) < 3f)
        {
            // Look at target's head
            Vector3 direction = (targetPlayer.position - head.position).normalized;
            Quaternion targetRotation = Quaternion.LookRotation(direction);
            
            // Smooth rotation
            head.rotation = Quaternion.Slerp(head.rotation, targetRotation, Time.deltaTime * 2f);
        }
    }
}
```

#### Week 9: In-VR UI

**Create floating UI panels** (inventory, settings):
```csharp
public class VRMenuController : MonoBehaviour
{
    public GameObject menuPanel;
    public Transform leftHand;
    
    void Update()
    {
        // Open menu with left menu button
        if (OVRInput.GetDown(OVRInput.Button.Start))
        {
            ToggleMenu();
        }
        
        // Position menu in front of left hand
        if (menuPanel.activeSelf)
        {
            menuPanel.transform.position = leftHand.position + leftHand.forward * 0.3f;
            menuPanel.transform.LookAt(Camera.main.transform);
        }
    }
    
    void ToggleMenu()
    {
        menuPanel.SetActive(!menuPanel.activeSelf);
    }
}
```

---

### Phase 4: Testing & Launch (Weeks 10-12)

#### Week 10: Performance Optimization

**Target FPS**: 72 FPS (Quest 2), 90 FPS (Quest 3), 120 FPS (PCVR)

**Optimize rendering**:
```csharp
// Use LOD (Level of Detail) for distant avatars
LODGroup lodGroup = remotePlayer.AddComponent<LODGroup>();
LOD[] lods = new LOD[3];
lods[0] = new LOD(0.6f, highDetailRenderers); // Close up
lods[1] = new LOD(0.3f, mediumDetailRenderers); // Medium distance
lods[2] = new LOD(0.1f, lowDetailRenderers); // Far away
lodGroup.SetLODs(lods);

// Object pooling for frequent spawns
public class ObjectPool {
    private Queue<GameObject> pool = new Queue<GameObject>();
    
    public GameObject Get() {
        if (pool.Count > 0) return pool.Dequeue();
        return Instantiate(prefab);
    }
    
    public void Return(GameObject obj) {
        obj.SetActive(false);
        pool.Enqueue(obj);
    }
}
```

**Network optimization**:
- Position updates: 10 Hz (not 60 Hz)
- Client-side prediction + interpolation
- Delta compression (only send changed values)

#### Week 11: Motion Sickness Testing

**Comfort settings**:
- Toggle: Smooth turn vs Snap turn
- Toggle: Smooth movement vs Teleport
- Vignette during movement (reduces peripheral vision)
- Lower FOV during fast movement

**Anti-nausea checklist**:
- ✅ Maintain 72+ FPS at all times
- ✅ No camera shake or forced movement
- ✅ Keep horizon level
- ✅ Fixed reference points (cockpit, grid floor)
- ✅ Short sessions for testing (10-15 min)

#### Week 12: Beta Testing

**Deploy to Meta Quest**:
```bash
# Build APK in Unity
# File → Build Settings → Android → Build

# Install on Quest via ADB
adb install -r MetaSpace.apk

# Run
adb shell am start -n com.yourcompany.metaspace/.MainActivity
```

**Beta testing plan**:
- 10-20 testers with Quest 2/3
- Test checklist:
  - ✅ Can join space and see other players
  - ✅ Voice chat works with spatial audio
  - ✅ Movement feels comfortable (no nausea)
  - ✅ Hand tracking works for interactions
  - ✅ Performance stays above 72 FPS
  - ✅ Can stay connected for 30+ minutes

---

## 🔒 Security & Privacy

### Voice Data
- **Do NOT store** raw audio files
- Encrypt WebRTC streams (DTLS-SRTP)
- Use ephemeral TURN credentials

### Personal Space
- **6 feet rule**: Block users who get too close (comfort feature)
- **Mute/block**: Easy access to moderation controls

```csharp
public class PersonalSpaceBoundary : MonoBehaviour
{
    public float boundaryRadius = 1.8f; // 6 feet
    
    void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("RemotePlayer"))
        {
            // Show warning UI
            ShowBoundaryWarning();
            
            // Push away gently
            Vector3 pushDirection = (transform.position - other.transform.position).normalized;
            other.GetComponent<Rigidbody>().AddForce(pushDirection * 5f, ForceMode.Impulse);
        }
    }
}
```

---

## 💰 Cost Estimate

| Component | Monthly Cost | One-time Cost |
|-----------|--------------|---------------|
| Unity Pro license | $185/seat | - |
| Oculus Developer Account | $0 | - |
| TURN servers (Twilio) | $0.40/GB | - |
| Asset bundles CDN | $10 | - |
| **Total** | **~$200/month** | **$0** |

---

## 📱 Supported Devices

### Launch (Week 12)
- Meta Quest 2
- Meta Quest 3
- Meta Quest Pro

### Future (Phase 2)
- PSVR 2 (PlayStation 5)
- Apple Vision Pro
- Valve Index / HTC Vive (SteamVR)

---

## 🎮 Input Comparison

| Device | 6DoF Tracking | Hand Tracking | Eye Tracking | Controllers |
|--------|---------------|---------------|--------------|-------------|
| Quest 2 | ✅ | ✅ | ❌ | Touch Controllers |
| Quest 3 | ✅ | ✅ (improved) | ❌ | Touch Plus |
| Quest Pro | ✅ | ✅ | ✅ | Touch Pro |
| PSVR 2 | ✅ | ❌ | ✅ | Sense Controllers |
| Vision Pro | ✅ | ✅ | ✅ | Hand + Eyes |

---

## 📊 Success Metrics

Track these KPIs after VR launch:

- **Adoption**: % of users who try VR client (target: 10% in first month)
- **Retention**: % who use VR again after first session (target: 50%+)
- **Session length**: VR vs desktop (target: 2x longer in VR)
- **Motion sickness**: % users reporting nausea (target: <5%)
- **Performance**: Avg FPS, frame drops (target: 72+ FPS, <1% drops)

---

## 🚀 Launch Checklist

Before shipping to Quest Store:

- [ ] Performance: 72+ FPS on Quest 2
- [ ] Battery: 2+ hours on single charge
- [ ] Network: Works on 4G/5G (not just WiFi)
- [ ] Comfort: <5% motion sickness reports
- [ ] Accessibility: Subtitles for deaf users
- [ ] Privacy: GDPR-compliant data handling
- [ ] Safety: Personal space boundaries
- [ ] Moderation: Mute/block/report features
- [ ] Testing: 100+ hours of beta testing
- [ ] Documentation: User manual + tutorials

---

## 🎯 Next Steps

**Ready to start? Here's what I can do:**

1. **Set up Unity project** - Create project structure, install packages
2. **Build VR player controller** - Movement, teleportation, hand tracking
3. **Integrate with backend** - Connect to existing WebSocket server
4. **Add WebRTC voice** - P2P voice chat with spatial audio
5. **Optimize performance** - Reach 72+ FPS on Quest 2

Which would you like to start with?
