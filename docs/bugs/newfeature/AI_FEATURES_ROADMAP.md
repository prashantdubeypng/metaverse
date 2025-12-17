# AI Features Roadmap for MetaSpace

**Priority-ranked AI features to boost product value**

---

## 🏆 Tier 1: Core Product Winners (Implement First)

### 1. Smart Avatars (Body + Voice Animation)

**Value**: Makes avatars expressive without expensive motion capture hardware.

**Tech Stack**:
- **MediaPipe** (Google) - Free face/pose tracking from webcam
- **Ready Player Me** - Avatar SDK with auto-rigging
- **Livelink Face** - iOS FaceID → avatar mapping

**Implementation** (4 weeks):

```typescript
// frontend/src/components/AvatarAnimator.tsx
import { FaceLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';

export class SmartAvatarController {
  private faceLandmarker: FaceLandmarker;
  private poseLandmarker: PoseLandmarker;
  
  async initialize() {
    // Load MediaPipe models (runs in browser)
    this.faceLandmarker = await FaceLandmarker.createFromOptions({
      baseOptions: {
        modelAssetPath: '/models/face_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO'
    });
    
    this.poseLandmarker = await PoseLandmarker.createFromOptions({
      baseOptions: {
        modelAssetPath: '/models/pose_landmarker_lite.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO'
    });
  }
  
  async updateFromWebcam(videoFrame: HTMLVideoElement) {
    // Detect face landmarks (lips, eyes, eyebrows)
    const faceResult = await this.faceLandmarker.detectForVideo(videoFrame, Date.now());
    
    // Detect body pose (shoulders, arms, head tilt)
    const poseResult = await this.poseLandmarker.detectForVideo(videoFrame, Date.now());
    
    // Map to avatar bones
    const avatarPose = {
      mouth: this.getMouthOpenness(faceResult),
      eyeL: this.getEyeOpenness(faceResult, 'left'),
      eyeR: this.getEyeOpenness(faceResult, 'right'),
      headRotation: this.getHeadRotation(poseResult),
      shoulderRotation: this.getShoulderRotation(poseResult),
    };
    
    // Send compressed pose data (< 100 bytes)
    this.sendPoseUpdate(avatarPose);
  }
  
  private getMouthOpenness(result: any): number {
    // Calculate jaw distance
    const upperLip = result.faceLandmarks[0][13];
    const lowerLip = result.faceLandmarks[0][14];
    return Math.abs(upperLip.y - lowerLip.y);
  }
}
```

**Bandwidth**: 10 Hz updates × 100 bytes = 1 KB/s per user

**Cost**: $0 (MediaPipe is free, runs client-side)

**Timeline**:
- Week 1: Integrate MediaPipe face tracking
- Week 2: Integrate pose tracking
- Week 3: Map to Ready Player Me avatar bones
- Week 4: Polish + optimize for low-end devices

---

### 2. Spatial Voice Processing

**Value**: Makes proximity feel real - voice gets quieter with distance, directional.

**Tech Stack**:
- **Web Audio API** - Built-in browser spatialization
- **Krisp.ai** - Noise cancellation (optional, $0.005/min)
- **Agora.io** - Managed spatial audio ($0.99/1000 min)

**Implementation** (2 weeks):

```typescript
// frontend/src/utils/SpatialAudio.ts
export class SpatialAudioEngine {
  private audioContext: AudioContext;
  private listenerNode: AudioListener;
  private panners: Map<string, PannerNode> = new Map();
  
  constructor() {
    this.audioContext = new AudioContext();
    this.listenerNode = this.audioContext.listener;
  }
  
  // Update listener position (local player)
  updateListenerPosition(x: number, y: number) {
    // 2D → 3D: map grid to 3D space
    this.listenerNode.positionX.value = x * 0.1; // scale down
    this.listenerNode.positionY.value = 0; // ground level
    this.listenerNode.positionZ.value = y * 0.1;
    
    // Listener faces "north" (negative Z)
    this.listenerNode.forwardX.value = 0;
    this.listenerNode.forwardY.value = 0;
    this.listenerNode.forwardZ.value = -1;
  }
  
  // Add remote user's audio stream
  addRemoteAudio(userId: string, stream: MediaStream, x: number, y: number) {
    const source = this.audioContext.createMediaStreamSource(stream);
    const panner = this.audioContext.createPanner();
    
    // Configure spatial panner
    panner.panningModel = 'HRTF'; // Binaural audio
    panner.distanceModel = 'inverse';
    panner.refDistance = 1; // Start attenuating at 1 tile
    panner.maxDistance = 10; // Silent beyond 10 tiles
    panner.rolloffFactor = 1;
    
    // Position audio source
    panner.positionX.value = x * 0.1;
    panner.positionY.value = 0;
    panner.positionZ.value = y * 0.1;
    
    // Connect: source → panner → destination
    source.connect(panner);
    panner.connect(this.audioContext.destination);
    
    this.panners.set(userId, panner);
  }
  
  // Update remote user position (called on movement)
  updateRemotePosition(userId: string, x: number, y: number) {
    const panner = this.panners.get(userId);
    if (panner) {
      panner.positionX.value = x * 0.1;
      panner.positionZ.value = y * 0.1;
    }
  }
  
  removeRemoteAudio(userId: string) {
    const panner = this.panners.get(userId);
    if (panner) {
      panner.disconnect();
      this.panners.delete(userId);
    }
  }
}
```

**Integration with video calls**:
```typescript
// In VideoCallManager.tsx
const spatialAudio = new SpatialAudioEngine();

// When local user moves
useEffect(() => {
  spatialAudio.updateListenerPosition(localUser.x, localUser.y);
}, [localUser.x, localUser.y]);

// When remote user joins call
peerConnection.ontrack = (event) => {
  spatialAudio.addRemoteAudio(
    remoteUser.id, 
    event.streams[0], 
    remoteUser.x, 
    remoteUser.y
  );
};

// When remote user moves
socket.on('user-moved', ({ userId, x, y }) => {
  spatialAudio.updateRemotePosition(userId, x, y);
});
```

**Cost**: $0 (Web Audio API is free)

**Timeline**:
- Week 1: Implement Web Audio spatial panner
- Week 2: Integrate with proximity video system, test + polish

---

### 3. Personalized Lobbies / Discovery Feed

**Value**: Users find interesting rooms/people faster → higher engagement.

**Tech Stack**:
- **PostgreSQL** - User interactions (joins, messages, time spent)
- **Redis** - Real-time trending rooms
- **Python** - Collaborative filtering model (scikit-learn)

**Data Model**:
```sql
-- Track user interactions
CREATE TABLE user_interactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  space_id VARCHAR(255) NOT NULL,
  interaction_type VARCHAR(50), -- 'join', 'message', 'like'
  duration_seconds INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_space ON user_interactions(user_id, space_id);
```

**Recommendation Engine** (Python microservice):
```python
# recommendation-service/app.py
from flask import Flask, jsonify
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
import psycopg2

app = Flask(__name__)

def get_user_space_matrix():
    """Build user-space interaction matrix"""
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    df = pd.read_sql("""
        SELECT user_id, space_id, 
               COUNT(*) as visits,
               SUM(duration_seconds) as total_time
        FROM user_interactions
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY user_id, space_id
    """, conn)
    
    # Pivot to matrix: rows=users, cols=spaces, values=engagement_score
    matrix = df.pivot_table(
        index='user_id', 
        columns='space_id', 
        values='total_time', 
        fill_value=0
    )
    return matrix

@app.route('/recommendations/<user_id>')
def get_recommendations(user_id):
    matrix = get_user_space_matrix()
    
    if user_id not in matrix.index:
        # New user: return trending spaces
        return jsonify(get_trending_spaces())
    
    # Find similar users
    user_vec = matrix.loc[user_id].values.reshape(1, -1)
    similarities = cosine_similarity(user_vec, matrix.values)[0]
    
    # Get top 5 similar users
    similar_users = matrix.index[similarities.argsort()[-6:-1]]
    
    # Recommend spaces they liked but user hasn't visited
    user_spaces = set(matrix.columns[matrix.loc[user_id] > 0])
    recommendations = []
    
    for similar_user in similar_users:
        their_spaces = set(matrix.columns[matrix.loc[similar_user] > 0])
        new_spaces = their_spaces - user_spaces
        recommendations.extend(new_spaces)
    
    # Rank by frequency
    from collections import Counter
    top_spaces = Counter(recommendations).most_common(5)
    
    return jsonify([space for space, _ in top_spaces])

def get_trending_spaces():
    """Fallback for new users"""
    # Get from Redis (updated every 5 min)
    import redis
    r = redis.Redis(host='localhost', port=6379)
    trending = r.zrevrange('trending:spaces', 0, 4)
    return [space.decode() for space in trending]
```

**Frontend Integration**:
```typescript
// frontend/src/app/dashboard/page.tsx
export default function Dashboard() {
  const { user } = useAuth();
  const [recommended, setRecommended] = useState([]);
  
  useEffect(() => {
    fetch(`/api/recommendations/${user.id}`)
      .then(res => res.json())
      .then(spaces => setRecommended(spaces));
  }, [user]);
  
  return (
    <div>
      <h2>Recommended for You</h2>
      {recommended.map(space => (
        <SpaceCard key={space.id} space={space} />
      ))}
    </div>
  );
}
```

**Cost**: 
- Python service: $10/month (single t3.micro instance)
- Postgres queries: minimal (uses existing DB)

**Timeline**:
- Week 1: Set up interaction tracking
- Week 2: Build recommendation API (Python)
- Week 3: Integrate frontend
- Week 4: A/B test + tune algorithm

---

### 4. Anti-Toxic Moderation (Real-Time)

**Value**: Keeps community safe, reduces manual moderation costs by 80%.

**Tech Stack**:
- **OpenAI Moderation API** - Free, 2ms latency
- **Perspective API** (Google) - Free, 100ms latency
- **WebPurify** - $10/month for profanity filter

**Implementation**:

```typescript
// packages/moderation/src/ModerationService.ts
import OpenAI from 'openai';

export class ModerationService {
  private openai: OpenAI;
  private cache: Map<string, boolean> = new Map();
  
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  
  async checkMessage(text: string): Promise<{ safe: boolean; reason?: string }> {
    // Check cache first (avoid re-checking same messages)
    if (this.cache.has(text)) {
      return { safe: this.cache.get(text)! };
    }
    
    // Call OpenAI Moderation API
    const response = await this.openai.moderations.create({ input: text });
    const result = response.results[0];
    
    if (result.flagged) {
      const category = Object.keys(result.categories).find(
        key => result.categories[key]
      );
      
      this.cache.set(text, false);
      return { safe: false, reason: category };
    }
    
    this.cache.set(text, true);
    return { safe: true };
  }
  
  async checkVoice(audioUrl: string): Promise<{ safe: boolean; transcript?: string }> {
    // Transcribe with Whisper
    const transcription = await this.openai.audio.transcriptions.create({
      file: await fetch(audioUrl).then(r => r.blob()),
      model: 'whisper-1'
    });
    
    // Check transcript
    const result = await this.checkMessage(transcription.text);
    return { ...result, transcript: transcription.text };
  }
}
```

**Auto-mute system**:
```typescript
// apps/ws/src/handlers/ChatHandler.ts
export class ChatHandler {
  private moderation: ModerationService;
  private violations: Map<string, number> = new Map(); // userId → count
  
  async handleMessage(userId: string, message: string) {
    const check = await this.moderation.checkMessage(message);
    
    if (!check.safe) {
      console.warn(`🚫 Blocked toxic message from ${userId}: ${check.reason}`);
      
      // Increment violation count
      const count = (this.violations.get(userId) || 0) + 1;
      this.violations.set(userId, count);
      
      // Auto-mute after 3 violations
      if (count >= 3) {
        await this.muteUser(userId, 3600); // 1 hour mute
        this.violations.delete(userId);
      }
      
      return { blocked: true, reason: 'Message violates community guidelines' };
    }
    
    // Message is safe - broadcast it
    await this.broadcastMessage(message);
    return { blocked: false };
  }
  
  private async muteUser(userId: string, durationSeconds: number) {
    await redis.setex(`muted:${userId}`, durationSeconds, '1');
    
    // Notify user
    const ws = this.connections.get(userId);
    ws?.send(JSON.stringify({
      type: 'moderation-action',
      payload: { action: 'muted', duration: durationSeconds }
    }));
  }
}
```

**Cost**: $0 (OpenAI Moderation API is free)

**Timeline**:
- Week 1: Integrate OpenAI Moderation for text chat
- Week 2: Add auto-mute system + violation tracking
- Week 3: Add voice moderation (Whisper transcription)

---

### 5. Procedural Content Generation

**Value**: Generate props, rooms, avatars from text prompts → save on 3D artist costs.

**Tech Stack**:
- **DALL-E 3** - 2D textures ($0.04/image)
- **Meshy.ai** - Text → 3D model ($0.10/model)
- **Stable Diffusion** - Self-hosted ($50/month GPU)

**Implementation**:

```typescript
// packages/ai-content/src/ContentGenerator.ts
import OpenAI from 'openai';
import { MeshyClient } from 'meshy-sdk';

export class ContentGenerator {
  private openai: OpenAI;
  private meshy: MeshyClient;
  
  constructor() {
    this.openai = new OpenAI();
    this.meshy = new MeshyClient(process.env.MESHY_API_KEY);
  }
  
  async generateRoomTexture(prompt: string): Promise<string> {
    // Generate floor/wall texture
    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: `Seamless tileable texture: ${prompt}`,
      size: '1024x1024',
      quality: 'standard',
    });
    
    const imageUrl = response.data[0].url;
    
    // Upload to S3 and return URL
    return await this.uploadToS3(imageUrl);
  }
  
  async generate3DProp(prompt: string): Promise<string> {
    // Generate 3D model from text
    const task = await this.meshy.createTextTo3D({
      prompt: prompt,
      art_style: 'realistic',
      negative_prompt: 'low quality, blurry'
    });
    
    // Poll until ready (usually 2-3 minutes)
    let result = await this.meshy.getTask(task.id);
    while (result.status !== 'SUCCEEDED') {
      await new Promise(resolve => setTimeout(resolve, 10000));
      result = await this.meshy.getTask(task.id);
    }
    
    // Download GLB file
    return result.model_url;
  }
  
  async generateAvatar(description: string): Promise<string> {
    // Use Ready Player Me avatar generator
    const response = await fetch('https://api.readyplayer.me/v1/avatars', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RPM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bodyType: 'fullbody',
        assets: await this.getAvatarAssets(description)
      })
    });
    
    const data = await response.json();
    return data.url; // GLB URL
  }
}
```

**Admin UI** for content generation:
```typescript
// frontend/src/app/admin/generate/page.tsx
export default function GenerateContent() {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  
  const handleGenerate = async (type: 'texture' | 'prop' | 'avatar') => {
    setGenerating(true);
    const res = await fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ type, prompt })
    });
    const data = await res.json();
    setResult(data.url);
    setGenerating(false);
  };
  
  return (
    <div>
      <input 
        value={prompt} 
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe what you want to generate..."
      />
      <button onClick={() => handleGenerate('prop')}>
        Generate 3D Prop
      </button>
      {generating && <Spinner />}
      {result && <ModelPreview url={result} />}
    </div>
  );
}
```

**Cost**: 
- DALL-E: $0.04/texture × 50/month = $2/month
- Meshy.ai: $0.10/model × 20/month = $2/month
- Total: ~$5/month for admin usage

**Timeline**:
- Week 1: DALL-E texture generation
- Week 2: 3D prop generation (Meshy.ai)
- Week 3: Ready Player Me avatar customization
- Week 4: Admin UI + content moderation

---

## 🥈 Tier 2: Engagement & Monetization

### 6. Avatar Style Marketplace

Users buy or generate custom skins, outfits, accessories.

**Revenue**: $2-5/item, 10% commission on user-generated content

**Timeline**: 6 weeks

---

### 7. Session Summaries / Highlights

After each session, AI generates:
- Text summary: "You met 5 people, discussed project ideas for 15 min"
- Short video clip: highlights of funny moments
- Shareable card for social media

**Tech**: GPT-4 for summaries, FFmpeg for video clips

**Timeline**: 4 weeks

---

### 8. Personal Assistant Bots (NPCs)

AI-powered NPCs that:
- Greet new users and give tours
- Answer FAQs
- Moderate conversations
- Lead mini-games or icebreakers

**Tech**: GPT-4 + text-to-speech (ElevenLabs)

**Timeline**: 6 weeks

---

## 🥉 Tier 3: Advanced / Niche

### 9. Emotion Detection (Use Carefully)

Detect user engagement from facial expressions → adapt environment.

**Privacy**: Must be opt-in, no data storage

**Timeline**: 8 weeks

---

### 10. AR/VR Hand Tracking Prediction

Fill in missing tracking data on low-end VR headsets using ML.

**Timeline**: 10 weeks

---

## 📊 Cost Summary

| Feature | Monthly Cost | One-time Cost |
|---------|--------------|---------------|
| Smart Avatars | $0 | $0 (free models) |
| Spatial Audio | $0 | $0 (Web Audio API) |
| Recommendations | $10 | $0 |
| Moderation | $0 | $0 (free API) |
| Content Gen | $5 | $0 |
| **Total (Tier 1)** | **$15/month** | **$0** |

---

## 🚀 Implementation Order

**Recommended sequence** (16 weeks total):

1. **Spatial Audio** (2 weeks) - Quick win, huge UX boost
2. **Smart Avatars** (4 weeks) - Core feature, high visibility
3. **Moderation** (3 weeks) - Essential for safety
4. **Recommendations** (4 weeks) - Drives engagement
5. **Content Gen** (4 weeks) - Reduces asset costs

After Tier 1 is done, reassess based on user feedback and metrics.

---

## 📈 Success Metrics

Track these KPIs for each feature:

- **Smart Avatars**: % users who enable webcam tracking
- **Spatial Audio**: Session length increase (target: +30%)
- **Recommendations**: Click-through rate on suggested rooms (target: >20%)
- **Moderation**: % toxic messages blocked (target: <1% false positives)
- **Content Gen**: Cost per asset vs hiring 3D artists (target: 90% savings)

---

**Next**: VR Implementation Guide (see VR_IMPLEMENTATION.md)
