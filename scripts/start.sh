#!/bin/bash
# Linux / macOS start script
cd "$(dirname "$0")/.."

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "Created .env file. Edit it to customize settings."
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building frontend..."
npm run build

echo ""
echo "==========================================="
echo " IT Ticket System"
echo " Running on: http://localhost:${PORT:-3000}"
echo "==========================================="
echo ""

# Production mode - server serves built frontend
NODE_ENV=production node src/backend/server.js
