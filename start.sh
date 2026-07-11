#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║           Hubly — Ticket System          ║"
echo "  ║        One-Click Launcher v2.0           ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# Setup .env
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo -e "  \033[32m[✓] Created .env from .env.example\033[0m"
fi

# Setup node_modules
if [ ! -d node_modules ]; then
  echo -e "  \033[33m[i] Installing dependencies...\033[0m"
  npm install
  echo -e "  \033[32m[✓] Dependencies installed\033[0m"
fi

# Setup data directories
mkdir -p data/uploads data/logs 2>/dev/null

# Read port
PORT=$(grep -oP '(?<=^PORT=).*' .env 2>/dev/null || echo "3000")

echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │   Select Mode:                          │"
echo "  │                                         │"
echo "  │   [1] Start (Development)               │"
echo "  │       - Hot reload frontend + backend   │"
echo "  │       - Opens at localhost:5173         │"
echo "  │                                         │"
echo "  │   [2] Start (Production)                │"
echo "  │       - Builds + serves                 │"
echo "  │       - Opens at localhost:${PORT}         │"
echo "  │                                         │"
echo "  │   [3] Exit                              │"
echo "  └─────────────────────────────────────────┘"
echo ""
read -p "  Select (1-3): " choice

case "$choice" in
  1)
    echo ""
    echo -e "  \033[36mStarting in Development Mode...\033[0m"
    echo -e "  \033[32mFrontend : http://localhost:5173\033[0m"
    echo -e "  \033[32mBackend  : http://localhost:$PORT\033[0m"
    echo ""
    sleep 2
    xdg-open "http://localhost:5173" 2>/dev/null || true
    npm run dev
    ;;
  2)
    echo ""
    echo -e "  \033[33mBuilding for production...\033[0m"
    npm run build
    echo ""
    echo -e "  \033[32mApp running at: http://localhost:$PORT\033[0m"
    echo ""
    export NODE_ENV=production
    xdg-open "http://localhost:$PORT" 2>/dev/null || true
    node src/backend/server.js
    ;;
  3)
    exit 0
    ;;
  *)
    echo -e "  \033[31mInvalid choice!\033[0m"
    exit 1
    ;;
esac
