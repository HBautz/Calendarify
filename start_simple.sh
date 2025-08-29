#!/bin/bash

# 🚀 Simple Calendarify Startup Script
# This script starts the services in a simple, reliable way

set -e

echo "🚀 Starting Calendarify Services..."
echo "=================================="

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up..."
    pkill -f "npm run start:dev" 2>/dev/null || true
    pkill -f "node server.js" 2>/dev/null || true
    lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true
    echo "✅ Cleanup completed"
}

# Set up signal handlers
trap cleanup EXIT
trap cleanup SIGINT
trap cleanup SIGTERM

# Kill any existing processes
echo "🔧 Cleaning up existing processes..."
pkill -f "npm run start:dev" 2>/dev/null || true
pkill -f "node server.js" 2>/dev/null || true
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true
sleep 3

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

# Start backend
echo "🚀 Starting backend server..."
cd backend
npm run start:dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to be fully ready (up to 10 minutes)
echo "⏳ Waiting for backend to start (this may take several minutes)..."
BACKEND_READY=false
for i in {1..60}; do
    if curl -s http://localhost:3001/api >/dev/null 2>&1; then
        echo "✅ Backend is running on http://localhost:3001"
        BACKEND_READY=true
        break
    fi
    
    # Check if backend process is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend process died unexpectedly"
        echo "📋 Backend logs:"
        tail -20 backend.log
        exit 1
    fi
    
    if [ $((i % 10)) -eq 0 ]; then
        echo "⏳ Still waiting for backend... ($((i * 10))s elapsed)"
    fi
    
    sleep 10
done

if [ "$BACKEND_READY" = false ]; then
    echo "❌ Backend failed to start within 10 minutes"
    echo "📋 Backend logs:"
    tail -50 backend.log
    exit 1
fi

# Start frontend
echo "🚀 Starting frontend server..."
node server.js > frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to be ready (up to 2 minutes)
echo "⏳ Waiting for frontend to start..."
FRONTEND_READY=false
for i in {1..12}; do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo "✅ Frontend is running on http://localhost:3000"
        FRONTEND_READY=true
        break
    fi
    
    # Check if frontend process is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend process died unexpectedly"
        echo "📋 Frontend logs:"
        tail -20 frontend.log
        exit 1
    fi
    
    if [ $((i % 3)) -eq 0 ]; then
        echo "⏳ Still waiting for frontend... ($((i * 10))s elapsed)"
    fi
    
    sleep 10
done

if [ "$FRONTEND_READY" = false ]; then
    echo "❌ Frontend failed to start within 2 minutes"
    echo "📋 Frontend logs:"
    tail -50 frontend.log
    exit 1
fi

# Final health check
echo "🔍 Final health check..."
sleep 5

if curl -s http://localhost:3001/api >/dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    exit 1
fi

if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ Frontend health check passed"
else
    echo "❌ Frontend health check failed"
    exit 1
fi

echo ""
echo "🎉 All services started successfully!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:3001"
echo ""
echo "📋 Logs:"
echo "  Backend: tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""
echo "💡 Press Ctrl+C to stop all services"
echo ""

# Keep the script running and monitor services
while true; do
    # Check if processes are still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend process died unexpectedly"
        echo "📋 Backend logs:"
        tail -20 backend.log
        exit 1
    fi
    
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend process died unexpectedly"
        echo "📋 Frontend logs:"
        tail -20 frontend.log
        exit 1
    fi
    
    sleep 30
done
