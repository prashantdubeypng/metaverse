🎮 2D Metaverse Collaboration Platform
A real-time, interactive 2D metaverse for collaboration with video/voice chat, public & private rooms, and secure access control.

🚀 Features
✅ 2D Metaverse Environment – Interactive space with user avatars, tables, and rooms.
✅ Real-Time Communication – Video & voice calls via WebRTC.
✅ Role-Based Access Control – Admins create public & private rooms, users create private rooms.
✅ Private Chat Rooms – User-controlled spaces with invite/request access.
✅ Test-Driven Development – Implemented using Jest with 90%+ coverage.
✅ Scalable Deployment – Docker + Kubernetes (AWS EKS) with automated CI/CD pipeline.

🛠 Tech Stack
Frontend: React, Pixi.js, TailwindCSS
Backend: Node.js, Express.js, MongoDB
Real-Time: Socket.IO, WebRTC
Deployment: Docker, Kubernetes, AWS EKS
CI/CD: GitHub Actions
Testing: Jest

📐 Architecture Diagram
flowchart TD
    A[User] --> B[React Frontend]
    B -->|REST API| C[Express Backend]
    B -->|WebSocket| D[Socket.IO Server]
    C --> E[(MongoDB)]
    D --> C
    B -->|WebRTC| F[Peer Connections]
    C --> G[Kubernetes Cluster on AWS]
    G --> H[Docker Containers]
(Use a real diagram via BlankBox or Mermaid Live when publishing.)

⚙️ Installation & Setup
1️⃣ Clone Repo

git clone https://github.com/prashantdubeypng/metaverse.git
cd metaverse-platform
2️⃣ Install Dependencies
npm install   # or yarn install
3️⃣ Run in Development
npm run dev
🧪 Running Tests
bash
npm run test
Coverage Report:

🐳 Docker Setup
docker build -t metaverse-app .
docker-compose up
☸️ Kubernetes Deployment
Apply K8s Manifests:


kubectl apply -f k8s/
Includes:

Deployment

Service

Ingress

ConfigMap & Secrets

🚀 CI/CD
GitHub Actions pipeline:

Run Tests → Build → Push Docker Image → Deploy to AWS EKS

📸 Screenshots / Demo Video

