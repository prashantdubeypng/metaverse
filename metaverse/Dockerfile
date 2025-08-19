# Production Dockerfile for the metaverse application
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy all package.json files
COPY apps/*/package.json ./apps/*/
COPY packages/*/package.json ./packages/*/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

RUN npm install -g pnpm serve

WORKDIR /app

# Copy built application
COPY --from=base /app .

# Expose ports
EXPOSE 3000 3001 3002 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start script
COPY start-production.sh .
RUN chmod +x start-production.sh

CMD ["./start-production.sh"]
