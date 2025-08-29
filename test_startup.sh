#!/bin/bash
echo "Testing backend startup time..."
echo "Starting timer..."

start_time=$(date +%s)
echo "Start time: $(date)"

# Wait for backend to start
while ! curl -s http://localhost:3001/api >/dev/null 2>&1; do
    elapsed=$(( $(date +%s) - start_time ))
    echo "Waiting... ${elapsed}s elapsed"
    sleep 5
    
    # Check if process is still running
    if ! pgrep -f "npm run start:dev" >/dev/null; then
        echo "❌ Backend process died!"
        exit 1
    fi
done

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "🎉 Backend started in ${duration} seconds!"
echo "End time: $(date)"
