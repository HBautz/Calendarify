#!/bin/bash

# 🔧 Calendarify Startup Fix Script
# This script fixes common causes of inconsistent startup times

echo "🔧 Calendarify Startup Fix Script"
echo "================================"

# Function to aggressively clean up processes
cleanup_processes() {
    echo "🧹 Aggressively cleaning up processes..."
    
    # Kill all related processes
    pkill -f "npm run start:dev" 2>/dev/null || true
    pkill -f "node.*start:dev" 2>/dev/null || true
    pkill -f "nest.*start" 2>/dev/null || true
    pkill -f "ts-node" 2>/dev/null || true
    
    # Kill processes on specific ports
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    
    # Wait for processes to fully terminate
    sleep 3
    
    echo "✅ Process cleanup complete"
}

# Function to clear caches
clear_caches() {
    echo "🗑️  Clearing caches..."
    
    # Clear TypeScript compilation cache
    if [ -d "backend/dist" ]; then
        rm -rf backend/dist
        echo "✅ Cleared TypeScript compilation cache"
    fi
    
    # Clear Node.js module cache (if any)
    if [ -d "backend/.nest" ]; then
        rm -rf backend/.nest
        echo "✅ Cleared NestJS cache"
    fi
    
    # Clear npm cache
    npm cache clean --force 2>/dev/null || true
    echo "✅ Cleared npm cache"
    
    echo "✅ Cache clearing complete"
}

# Function to reinstall dependencies
reinstall_dependencies() {
    echo "📦 Reinstalling dependencies..."
    
    cd backend
    
    # Remove node_modules
    if [ -d "node_modules" ]; then
        rm -rf node_modules
        echo "✅ Removed node_modules"
    fi
    
    # Remove package-lock.json
    if [ -f "package-lock.json" ]; then
        rm package-lock.json
        echo "✅ Removed package-lock.json"
    fi
    
    # Reinstall dependencies
    echo "📦 Installing dependencies (this may take a few minutes)..."
    npm install
    
    cd ..
    echo "✅ Dependency reinstallation complete"
}

# Function to optimize file watchers
optimize_file_watchers() {
    echo "👁️  Optimizing file watchers..."
    
    # Check current file watcher limits
    if command -v sysctl >/dev/null 2>&1; then
        current_limit=$(sysctl -n fs.inotify.max_user_watches 2>/dev/null || echo "unknown")
        echo "📊 Current file watcher limit: $current_limit"
        
        if [ "$current_limit" != "unknown" ] && [ "$current_limit" -lt 524288 ]; then
            echo "⚠️  File watcher limit is low. Consider increasing it:"
            echo "   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf"
            echo "   sudo sysctl -p"
        fi
    fi
    
    # Create .gitignore entries to reduce watched files
    if [ ! -f "backend/.gitignore" ] || ! grep -q "node_modules" backend/.gitignore; then
        echo "📝 Adding common ignore patterns to reduce watched files..."
        cat >> backend/.gitignore << EOF

# Development files to reduce file watchers
*.log
*.tmp
*.temp
.env.local
.env.development.local
.env.test.local
.env.production.local
EOF
        echo "✅ Added ignore patterns"
    fi
}

# Function to test startup after fixes
test_startup() {
    echo "🧪 Testing startup after fixes..."
    
    # Clean up first
    cleanup_processes
    
    # Start backend
    cd backend
    echo "🚀 Starting backend..."
    npm run start:dev > ../test_startup.log 2>&1 &
    backend_pid=$!
    cd ..
    
    # Wait for startup
    local started=false
    for i in {1..30}; do
        if curl -s http://localhost:3001/api >/dev/null 2>&1; then
            echo "✅ Backend started successfully in ~$((i * 2)) seconds"
            started=true
            break
        fi
        
        # Check if process died
        if ! kill -0 $backend_pid 2>/dev/null; then
            echo "❌ Backend process died during test"
            echo "📋 Test logs:"
            tail -20 test_startup.log
            return 1
        fi
        
        sleep 2
    done
    
    if [ "$started" = false ]; then
        echo "❌ Backend failed to start within 60 seconds"
        echo "📋 Test logs:"
        tail -50 test_startup.log
        return 1
    fi
    
    # Clean up test
    kill $backend_pid 2>/dev/null || true
    echo "✅ Startup test completed successfully"
    return 0
}

# Main fix flow
echo "🔧 Running startup fixes..."
echo ""

# Ask user what to do
echo "Choose what to fix:"
echo "1. Quick cleanup (recommended first)"
echo "2. Full cleanup + cache clearing"
echo "3. Full cleanup + cache clearing + dependency reinstall"
echo "4. Just test current state"
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo "🔧 Running quick cleanup..."
        cleanup_processes
        optimize_file_watchers
        ;;
    2)
        echo "🔧 Running full cleanup..."
        cleanup_processes
        clear_caches
        optimize_file_watchers
        ;;
    3)
        echo "🔧 Running complete fix..."
        cleanup_processes
        clear_caches
        reinstall_dependencies
        optimize_file_watchers
        ;;
    4)
        echo "🧪 Just testing current state..."
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🧪 Testing startup..."
test_startup

echo ""
echo "🔧 Fix script complete!"
echo ""
echo "💡 If startup is still inconsistent, try:"
echo "  1. Restart your computer"
echo "  2. Check for antivirus software interfering"
echo "  3. Run the diagnostic script: ./diagnose_startup.sh"
