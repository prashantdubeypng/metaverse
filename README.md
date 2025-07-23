Of course\! Here is a more polished and professionally formatted version of your README file. It's structured for better readability and visual appeal on platforms like GitHub.

-----

# 🎮 2D Metaverse Collaboration Platform

Welcome to the 2D Metaverse Collaboration Platform\! This is a real-time, interactive 2D world designed for seamless team collaboration. It features integrated video and voice chat, public and private rooms, and a secure, role-based access system.

[](https://www.google.com/search?q=https://codecov.io/gh/prashantdubeypng/metaverse)
[](https://opensource.org/licenses/MIT)

-----

### 📸 Screenshots & Demo

*(Here you can add a link to a live demo or embed screenshots/GIFs of your platform)*

*A preview of the interactive workspace.*

## 🚀 Key Features

  * **✅ 2D Metaverse Environment**: A fully interactive 2D space where users can move their avatars, join tables, and enter different rooms to collaborate.
  * **✅ Real-Time Communication**: High-quality video and voice calls powered by WebRTC for direct, peer-to-peer communication.
  * **✅ Role-Based Access Control**: Admins can create and manage public and private rooms. Standard users can create their own private, temporary rooms.
  * **✅ Private Chat Rooms**: Users can create their own private spaces and control access through direct invitations or by approving requests to join.
  * **✅ Test-Driven Development**: The application is built with a TDD approach using Jest, achieving over 90% test coverage for a robust and reliable codebase.
  * **✅ Scalable Deployment**: Ready for production with Docker containerization and a Kubernetes-managed deployment on AWS EKS, complete with an automated CI/CD pipeline.

## 🛠️ Tech Stack

| Category         | Technologies                               |
| ---------------- | ------------------------------------------ |
| **Frontend** | `React`, `Pixi.js`, `TailwindCSS`            |
| **Backend** | `Node.js`, `Express.js`, `MongoDB`         |
| **Real-Time** | `Socket.IO`, `WebRTC`                      |
| **Testing** | `Jest`                                     |
| **Deployment** | `Docker`, `Kubernetes (AWS EKS)`           |
| **CI/CD** | `GitHub Actions`                           |

## 📐 Architecture

The platform uses a scalable microservices-oriented architecture. The frontend communicates with the backend via a REST API for standard requests and a WebSocket connection for real-time events. Peer-to-peer WebRTC connections are established for video/voice chat to minimize server load.

```mermaid
flowchart TD
    A[User's Browser] --> B[React Frontend];
    B -->|REST API (HTTPS)| C[Express Backend];
    B -->|WebSocket (WSS)| D[Socket.IO Server];
    B <-.->|WebRTC Peer-to-Peer| B;
    C --> E[(MongoDB Database)];
    D --> C;

    subgraph "AWS Cloud"
        direction LR
        G[Kubernetes Cluster on EKS]
    end

    C --> G;
    D --> G;
    G --> H[Docker Containers];
```

## ⚙️ Getting Started

Follow these instructions to get a local development environment up and running.

### Prerequisites

  * Node.js (v18.x or later)
  * npm or yarn
  * MongoDB Instance (local or cloud-hosted)
  * Git

### Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/prashantdubeypng/metaverse.git
    cd metaverse
    ```

2.  **Install dependencies:**

    ```bash
    # Using npm
    npm install

    # Or using yarn
    yarn install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root of the project and add the necessary configuration (e.g., MongoDB connection string, JWT secret).

    ```
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_super_secret_key
    ```

4.  **Run in Development Mode:**
    This command will start the frontend and backend servers concurrently.

    ```bash
    npm run dev
    ```

    The application should now be running on `http://localhost:3000`.

## 🧪 Running Tests

To run the full test suite and see the coverage report, use the following command:

```bash
npm run test
```

## 🐳 Docker Deployment

The application is fully containerized for easy and consistent deployments.

1.  **Build the Docker image:**

    ```bash
    docker build -t metaverse-app .
    ```

2.  **Run using Docker Compose:**
    `docker-compose` will build the image and start the container, along with a MongoDB service if configured.

    ```bash
    docker-compose up
    ```

## ☸️ Kubernetes Deployment

The project includes Kubernetes manifests for deploying to a cluster like AWS EKS.

1.  **Configure your `kubectl` context** to point to your Kubernetes cluster.

2.  **Apply the Kubernetes manifests:**
    This single command applies all configurations located in the `k8s/` directory.

    ```bash
    kubectl apply -f k8s/
    ```

    This will set up the following resources:

      * **Deployment**: Manages the application pods.
      * **Service**: Exposes the application within the cluster.
      * **Ingress**: Manages external access to the application.
      * **ConfigMap & Secrets**: Manages configuration and sensitive data.

## 🚀 CI/CD Pipeline

This project uses **GitHub Actions** for its Continuous Integration & Continuous Deployment pipeline. The workflow is defined in `.github/workflows/ci.yml` and performs the following steps on every push to the `main` branch:

1.  **Run Tests**: Executes the Jest test suite.
2.  **Build Docker Image**: Builds the production-ready Docker image.
3.  **Push to Registry**: Pushes the new image to a container registry (e.g., Docker Hub, AWS ECR).
4.  **Deploy to EKS**: Automatically triggers a rolling update of the deployment on the AWS EKS cluster.
