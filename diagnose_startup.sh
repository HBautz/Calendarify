#!/bin/bash

# 🔍 Calendarify Startup Diagnostics
# This script helps identify why backend startup times are inconsistent

echo "🔍 Calendarify Startup Diagnostics"
echo "=================================="

# Function to check if a port is actually free
check_port() {
    local port=$1
    echo "🔍 Checking port $port..."
    
    # Method 1: lsof
    if lsof -i:$port >/dev/null 2>&1; then
        echo "❌ Port $port is in use (lsof detected)"
        lsof -i:$port
        return 1
    fi
    
    # Method 2: netstat
    if netstat -an | grep ":$port " | grep LISTEN >/dev/null 2>&1; then
        echo "❌ Port $port is in use (netstat detected)"
        netstat -an | grep ":$port "
        return 1
    fi
    
    # Method 3: Try to bind to the port
    if python3 -c "import socket; s=socket.socket(); s.bind(('localhost', $port)); s.close()" 2>/dev/null; then
        echo "✅ Port $port is free (bind test passed)"
        return 0
    else
        echo "❌ Port $port is in use (bind test failed)"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    echo "🔍 Checking database connectivity..."
    
    # Check if PostgreSQL is running
    if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        echo "❌ PostgreSQL is not running or not accessible"
        return 1
    fi
    
    # Check if we can connect to the database
    if ! psql -h localhost -d calendarify -c "SELECT 1;" >/dev/null 2>&1; then
        echo "❌ Cannot connect to calendarify database"
        return 1
    fi
    
    echo "✅ Database connectivity is good"
    return 0
}

# Function to check file system
check_filesystem() {
    echo "🔍 Checking file system..."
    
    # Check if backend directory exists and has expected files
    if [ ! -d "backend" ]; then
        echo "❌ Backend directory not found"
        return 1
    fi
    
    if [ ! -f "backend/package.json" ]; then
        echo "❌ Backend package.json not found"
        return 1
    fi
    
    if [ ! -f "backend/node_modules/.bin/nest" ]; then
        echo "⚠️  NestJS CLI not found in node_modules - dependencies may not be installed"
    fi
    
    # Check disk space
    local available_space=$(df . | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 1000000 ]; then
        echo "⚠️  Low disk space: ${available_space}KB available"
    else
        echo "✅ Sufficient disk space: ${available_space}KB available"
    fi
    
    return 0
}

# Function to check for stuck processes
check_stuck_processes() {
    echo "🔍 Checking for stuck processes..."
    
    # Check for any Node.js processes
    local node_processes=$(pgrep -f "node.*start:dev" 2>/dev/null || true)
    if [ -n "$node_processes" ]; then
        echo "⚠️  Found Node.js processes that might be stuck:"
        ps -p $node_processes -o pid,ppid,command
    else
        echo "✅ No stuck Node.js processes found"
    fi
    
    # Check for any npm processes
    local npm_processes=$(pgrep -f "npm.*start:dev" 2>/dev/null || true)
    if [ -n "$npm_processes" ]; then
        echo "⚠️  Found npm processes that might be stuck:"
        ps -p $npm_processes -o pid,ppid,command
    else
        echo "✅ No stuck npm processes found"
    fi
}

# Function to test backend startup with timing
test_backend_startup() {
    echo "🔍 Testing backend startup..."
    
    # Clean up first
    pkill -f "npm run start:dev" 2>/dev/null || true
    pkill -f "node.*start:dev" 2>/dev/null || true
    sleep 2
    
    # Check ports are free
    if ! check_port 3001; then
        echo "❌ Cannot test startup - port 3001 is not free"
        return 1
    fi
    
    echo "🚀 Starting backend for timing test..."
    cd backend
    
    # Start backend and time it
    start_time=$(date +%s)
    npm run start:dev > ../startup_test.log 2>&1 &
    backend_pid=$!
    
    # Wait for backend to start
    local started=false
    for i in {1..60}; do
        if curl -s http://localhost:3001/api >/dev/null 2>&1; then
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            echo "✅ Backend started successfully in ${duration} seconds"
            started=true
            break
        fi
        
        # Check if process died
        if ! kill -0 $backend_pid 2>/dev/null; then
            echo "❌ Backend process died during startup"
            echo "📋 Startup logs:"
            tail -20 ../startup_test.log
            return 1
        fi
        
        sleep 2
    done
    
    if [ "$started" = false ]; then
        echo "❌ Backend failed to start within 120 seconds"
        echo "📋 Startup logs:"
        tail -50 ../startup_test.log
        return 1
    fi
    
    # Clean up
    kill $backend_pid 2>/dev/null || true
    cd ..
    
    return 0
}

# Main diagnostic flow
echo "🔍 Running comprehensive diagnostics..."
echo ""

# Check ports
check_port 3000
check_port 3001
echo ""

# Check database
check_database
echo ""

# Check file system
check_filesystem
echo ""

# Check for stuck processes
check_stuck_processes
echo ""

# Test backend startup
echo "🔍 Running backend startup test..."
test_backend_startup
echo ""

echo "🔍 Diagnostics complete!"
echo ""
echo "📋 If startup times are inconsistent, common solutions:"
echo "  1. Restart your computer (clears stuck processes)"
echo "  2. Clear node_modules and reinstall: rm -rf backend/node_modules && cd backend && npm install"
echo "  3. Clear TypeScript cache: rm -rf backend/dist"
echo "  4. Check for antivirus software interfering with file watching"
echo "  5. Increase file watcher limits: echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf"
