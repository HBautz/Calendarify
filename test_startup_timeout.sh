#!/bin/bash
echo "Testing backend startup time with timeout..."
echo "Starting timer..."

start_time=$(date +%s)
echo "Start time: $(date)"

# Start backend in background
echo "Starting backend..."
npm run start:dev > backend.log 2>&1 &
backend_pid=$!

# Wait for backend to start with timeout (2 minutes)
timeout_seconds=120
elapsed=0

while [ $elapsed -lt $timeout_seconds ]; do
    if curl -s http://localhost:3001/api >/dev/null 2>&1; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        echo "🎉 Backend started in ${duration} seconds!"
        echo "End time: $(date)"
        
        # Kill the backend process
        kill $backend_pid 2>/dev/null
        exit 0
    fi
    
    # Check if process is still running
    if ! kill -0 $backend_pid 2>/dev/null; then
        echo "❌ Backend process died!"
        echo "Logs:"
        tail -20 backend.log
        exit 1
    fi
    
    sleep 5
    elapsed=$((elapsed + 5))
    echo "Waiting... ${elapsed}s elapsed"
done

echo "❌ Backend failed to start within ${timeout_seconds} seconds"
echo "Logs:"
tail -50 backend.log

# Kill the backend process
kill $backend_pid 2>/dev/null
exit 1
