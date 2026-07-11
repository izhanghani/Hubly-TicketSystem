# Multi-stage build for Node.js + Vite frontend app
# Stage 1: Build dependencies and frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with retry
RUN npm install --legacy-peer-deps && npm cache clean --force

# Copy source code
COPY src ./src
COPY vite.config.js ./

# Build the Vite frontend
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built frontend from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy backend source
COPY --chown=nodejs:nodejs src/backend ./src/backend

# Create data directories
RUN mkdir -p data/uploads data/logs && \
    chown -R nodejs:nodejs data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "server"]
