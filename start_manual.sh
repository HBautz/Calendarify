#!/bin/bash

# 🚀 Manual Calendarify Startup Script
# This script just starts the services and lets you manage them manually

echo "🚀 Starting Calendarify Services (Manual Mode)..."
echo "================================================"

# Kill any existing processes
echo "🔧 Cleaning up existing processes..."
pkill -f "npm run start:dev" 2>/dev/null || true
pkill -f "node server.js" 2>/dev/null || true
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true
sleep 2

# Check if ports are free
echo "🔍 Checking ports..."
if lsof -i:3000 >/dev/null 2>&1; then
    echo "❌ Port 3000 is still in use"
    exit 1
fi
if lsof -i:3001 >/dev/null 2>&1; then
    echo "❌ Port 3001 is still in use"
    exit 1
fi
echo "✅ Ports are free"

# Start backend in a new terminal window
echo "🚀 Starting backend server in new terminal..."
if command -v osascript >/dev/null 2>&1; then
    # macOS
    osascript -e 'tell application "Terminal" to do script "cd '$(pwd)'/backend && npm run start:dev"'
else
    # Linux/other
    gnome-terminal -- bash -c "cd $(pwd)/backend && npm run start:dev; exec bash" 2>/dev/null || \
    xterm -e "cd $(pwd)/backend && npm run start:dev; exec bash" 2>/dev/null || \
    echo "⚠️  Could not open new terminal. Please run 'cd backend && npm run start:dev' manually"
fi

# Wait a moment
sleep 3

# Start frontend in a new terminal window
echo "🚀 Starting frontend server in new terminal..."
if command -v osascript >/dev/null 2>&1; then
    # macOS
    osascript -e 'tell application "Terminal" to do script "cd '$(pwd)' && node server.js"'
else
    # Linux/other
    gnome-terminal -- bash -c "cd $(pwd) && node server.js; exec bash" 2>/dev/null || \
    xterm -e "cd $(pwd) && node server.js; exec bash" 2>/dev/null || \
    echo "⚠️  Could not open new terminal. Please run 'node server.js' manually"
fi

echo ""
echo "🎉 Services started in separate terminals!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:3001"
echo ""
echo "💡 You can now manage each service independently:"
echo "  - Backend terminal: Stop with Ctrl+C"
echo "  - Frontend terminal: Stop with Ctrl+C"
echo ""
echo "📋 To check if services are running:"
echo "  curl http://localhost:3000"
echo "  curl http://localhost:3001/api"
echo ""
echo "✅ This script is now complete - services are running in separate terminals"
