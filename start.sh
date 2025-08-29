#!/bin/bash

# 🚀 Calendarify Production Server Startup Script
# This script provides a simple way to start the production-grade development server

set -e  # Exit on any error

echo "🚀 Starting Calendarify Production Server..."
echo "=========================================="

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.9 or higher."
    exit 1
fi

# Check if required Python packages are installed
echo "📦 Checking Python dependencies..."
if ! python3 -c "import psutil, requests" 2>/dev/null; then
    echo "📦 Installing required Python packages..."
    pip3 install -r requirements.txt 2>/dev/null || pip3 install psutil requests
fi

# Check if we're in the right directory
if [ ! -f "run_local.py" ]; then
    echo "❌ run_local.py not found. Please run this script from the Calendarify root directory."
    exit 1
fi

# Start the production server
echo "🚀 Launching production server..."
python3 run_local.py

# The script will handle everything else automatically
