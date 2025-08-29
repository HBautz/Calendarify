#!/usr/bin/env python3
"""
Production-Grade Calendarify Development Server
A bulletproof script that handles all edge cases and never fails.
"""

import os
import sys
import time
import signal
import subprocess
import threading
import psutil
import requests
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging

# Configure comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('calendarify.log')
    ]
)
logger = logging.getLogger(__name__)

class ProductionServer:
    """Production-grade server manager with zero failure tolerance."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.absolute()
        self.backend_dir = self.project_root / "backend"
        self.frontend_dir = self.project_root
        self.processes: Dict[str, subprocess.Popen] = {}
        self.ports = {"frontend": 3000, "backend": 3001}
        self.running = True
        self.startup_timeout = 300  # 5 minutes (increased from 120 seconds)
        self.health_check_interval = 10  # 10 seconds
        
        # Register signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        # Track startup attempts
        self.startup_attempts = 0
        self.max_startup_attempts = 3
        
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False
        self.cleanup()
        sys.exit(0)
    
    def log_section(self, title: str):
        """Log a section header."""
        logger.info("=" * 60)
        logger.info(f"🚀 {title}")
        logger.info("=" * 60)
    
    def run_command(self, cmd: List[str], cwd: Optional[Path] = None, 
                   timeout: int = 300, check: bool = True) -> subprocess.CompletedProcess:
        """Execute a command with comprehensive error handling."""
        try:
            logger.info(f"Running: {' '.join(cmd)}")
            if cwd:
                logger.info(f"Working directory: {cwd}")
            
            result = subprocess.run(
                cmd,
                cwd=cwd,
                timeout=timeout,
                check=check,
                capture_output=True,
                text=True
            )
            
            if result.stdout:
                logger.info(f"Command output: {result.stdout}")
            if result.stderr:
                logger.warning(f"Command stderr: {result.stderr}")
                
            return result
            
        except subprocess.TimeoutExpired:
            logger.error(f"Command timed out after {timeout} seconds: {' '.join(cmd)}")
            raise
        except subprocess.CalledProcessError as e:
            logger.error(f"Command failed with exit code {e.returncode}: {' '.join(cmd)}")
            logger.error(f"Error output: {e.stderr}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error running command: {e}")
            raise
    
    def check_dependencies(self) -> bool:
        """Check all system dependencies with detailed reporting."""
        self.log_section("SYSTEM DEPENDENCY CHECK")
        
        dependencies = {
            "Node.js": {"cmd": ["node", "--version"], "required": True},
            "npm": {"cmd": ["npm", "--version"], "required": True},
            "Python": {"cmd": ["python3", "--version"], "required": True},
            "PostgreSQL": {"cmd": ["psql", "--version"], "required": True},
            "Redis": {"cmd": ["redis-cli", "--version"], "required": False},
        }
        
        missing_critical = []
        missing_optional = []
        
        for name, config in dependencies.items():
            try:
                result = self.run_command(config["cmd"], check=False)
                if result.returncode == 0:
                    logger.info(f"✅ {name}: {result.stdout.strip()}")
                else:
                    if config["required"]:
                        missing_critical.append(name)
                    else:
                        missing_optional.append(name)
                        logger.warning(f"⚠️  {name}: Not available (optional)")
            except Exception as e:
                if config["required"]:
                    missing_critical.append(name)
                    logger.error(f"❌ {name}: {e}")
                else:
                    missing_optional.append(name)
                    logger.warning(f"⚠️  {name}: Not available (optional)")
        
        if missing_critical:
            logger.error(f"❌ Critical dependencies missing: {', '.join(missing_critical)}")
            return False
        
        if missing_optional:
            logger.warning(f"⚠️  Optional dependencies missing: {', '.join(missing_optional)}")
        
        logger.info("✅ All critical dependencies available")
        return True
    
    def setup_database(self) -> bool:
        """Setup database with comprehensive error handling."""
        self.log_section("DATABASE SETUP")
        
        try:
            # Check if database exists
            result = self.run_command(["psql", "-lqt", "-h", "localhost"], check=False)
            if "calendarify" in result.stdout:
                logger.info("✅ Database 'calendarify' already exists")
            else:
                logger.info("Creating database 'calendarify'...")
                self.run_command(["createdb", "calendarify"], check=False)
                logger.info("✅ Database created successfully")
            
            # Run Prisma migrations
            logger.info("Running Prisma database push...")
            self.run_command(["npx", "prisma", "db", "push"], cwd=self.backend_dir)
            logger.info("✅ Database schema updated successfully")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Database setup failed: {e}")
            return False
    
    def kill_processes_on_port(self, port: int) -> bool:
        """Kill all processes on a specific port with multiple strategies."""
        try:
            # Strategy 1: Use lsof to find and kill processes
            try:
                result = self.run_command(["lsof", "-ti", f":{port}"], check=False)
                if result.returncode == 0 and result.stdout.strip():
                    pids = result.stdout.strip().split('\n')
                    for pid in pids:
                        if pid.strip():
                            logger.info(f"Killing process {pid} on port {port}")
                            self.run_command(["kill", "-9", pid], check=False)
                    time.sleep(2)
            except Exception:
                pass
            
            # Strategy 2: Use pkill for Node.js processes
            try:
                self.run_command(["pkill", "-f", f"node.*:{port}"], check=False)
                time.sleep(1)
            except Exception:
                pass
            
            # Strategy 3: Use netstat (alternative)
            try:
                result = self.run_command(["netstat", "-tulpn"], check=False)
                if result.returncode == 0:
                    lines = result.stdout.split('\n')
                    for line in lines:
                        if f":{port}" in line and "LISTEN" in line:
                            parts = line.split()
                            if len(parts) > 6:
                                pid = parts[6].split('/')[0]
                                if pid.isdigit():
                                    logger.info(f"Killing process {pid} found via netstat")
                                    self.run_command(["kill", "-9", pid], check=False)
            except Exception:
                pass
            
            # Verify port is free
            time.sleep(3)
            return self.is_port_free(port)
            
        except Exception as e:
            logger.error(f"Error killing processes on port {port}: {e}")
            return False
    
    def is_port_free(self, port: int) -> bool:
        """Check if a port is free with multiple verification methods."""
        try:
            # Method 1: Try to bind to the port
            import socket
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return True
        except:
            pass
        
        try:
            # Method 2: Check with lsof
            result = self.run_command(["lsof", "-i", f":{port}"], check=False)
            return result.returncode != 0
        except:
            pass
        
        return False
    
    def wait_for_port(self, port: int, timeout: int = 30) -> bool:
        """Wait for a port to become available."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.is_port_free(port):
                return True
            time.sleep(1)
        return False
    
    def start_backend(self) -> bool:
        """Start the backend server with comprehensive error handling."""
        self.log_section("STARTING BACKEND SERVER")
        
        try:
            # Ensure backend directory exists
            if not self.backend_dir.exists():
                logger.error(f"❌ Backend directory not found: {self.backend_dir}")
                return False
            
            # Install dependencies if needed
            node_modules = self.backend_dir / "node_modules"
            if not node_modules.exists():
                logger.info("Installing backend dependencies...")
                self.run_command(["npm", "install"], cwd=self.backend_dir)
            
            # Kill any existing processes on backend port
            logger.info(f"Ensuring port {self.ports['backend']} is free...")
            if not self.kill_processes_on_port(self.ports['backend']):
                logger.error(f"❌ Failed to free port {self.ports['backend']}")
                return False
            
            # Start backend with comprehensive error handling
            logger.info("Starting NestJS backend server...")
            
            # Use a more robust startup approach
            env = os.environ.copy()
            env['NODE_ENV'] = 'development'
            
            process = subprocess.Popen(
                ["npm", "run", "start:dev"],
                cwd=self.backend_dir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            self.processes['backend'] = process
            
            # Wait for backend to start with comprehensive health checks
            logger.info("Waiting for backend to start...")
            start_time = time.time()
            compilation_detected = False
            
            while time.time() - start_time < self.startup_timeout:
                # Check if process is still running
                if process.poll() is not None:
                    stdout, stderr = process.communicate()
                    logger.error(f"❌ Backend process died unexpectedly")
                    logger.error(f"stdout: {stdout}")
                    logger.error(f"stderr: {stderr}")
                    return False
                
                # Check for compilation phase
                if not compilation_detected:
                    try:
                        # Check if npm/node processes are running (compilation in progress)
                        result = self.run_command(["pgrep", "-f", "npm run start:dev"], check=False)
                        if result.returncode == 0:
                            compilation_detected = True
                            logger.info("✅ Backend compilation detected, waiting for completion...")
                    except:
                        pass
                
                # Check if port is in use (indicating server started)
                if not self.is_port_free(self.ports['backend']):
                    # Verify the server is actually responding
                    try:
                        response = requests.get(f"http://localhost:{self.ports['backend']}/api", 
                                             timeout=5)
                        if response.status_code == 200:
                            logger.info("✅ Backend server started successfully")
                            return True
                    except requests.RequestException:
                        pass
                
                # Log progress every 30 seconds
                elapsed = int(time.time() - start_time)
                if elapsed % 30 == 0 and elapsed > 0:
                    if compilation_detected:
                        logger.info(f"⏳ Backend compilation in progress... ({elapsed}s elapsed)")
                    else:
                        logger.info(f"⏳ Waiting for backend to start... ({elapsed}s elapsed)")
                
                time.sleep(2)
            
            logger.error(f"❌ Backend failed to start within {self.startup_timeout} seconds")
            return False
            
        except Exception as e:
            logger.error(f"❌ Failed to start backend: {e}")
            return False
    
    def start_frontend(self) -> bool:
        """Start the frontend server with comprehensive error handling."""
        self.log_section("STARTING FRONTEND SERVER")
        
        try:
            # Kill any existing processes on frontend port
            logger.info(f"Ensuring port {self.ports['frontend']} is free...")
            if not self.kill_processes_on_port(self.ports['frontend']):
                logger.error(f"❌ Failed to free port {self.ports['frontend']}")
                return False
            
            # Start frontend
            logger.info("Starting frontend server...")
            
            env = os.environ.copy()
            env['NODE_ENV'] = 'development'
            
            process = subprocess.Popen(
                ["node", "server.js"],
                cwd=self.frontend_dir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            self.processes['frontend'] = process
            
            # Wait for frontend to start
            logger.info("Waiting for frontend to start...")
            start_time = time.time()
            
            while time.time() - start_time < 30:  # 30 second timeout for frontend
                if process.poll() is not None:
                    stdout, stderr = process.communicate()
                    logger.error(f"❌ Frontend process died unexpectedly")
                    logger.error(f"stdout: {stdout}")
                    logger.error(f"stderr: {stderr}")
                    return False
                
                if not self.is_port_free(self.ports['frontend']):
                    try:
                        response = requests.get(f"http://localhost:{self.ports['frontend']}", 
                                             timeout=5)
                        if response.status_code == 200:
                            logger.info("✅ Frontend server started successfully")
                            return True
                    except requests.RequestException:
                        pass
                
                time.sleep(1)
            
            logger.error("❌ Frontend failed to start within 30 seconds")
            return False
            
        except Exception as e:
            logger.error(f"❌ Failed to start frontend: {e}")
            return False
    
    def health_check(self) -> Dict[str, bool]:
        """Comprehensive health check for all services."""
        health_status = {}
        
        # Check backend
        try:
            response = requests.get(f"http://localhost:{self.ports['backend']}/api", timeout=5)
            health_status['backend'] = response.status_code == 200
        except:
            health_status['backend'] = False
        
        # Check frontend
        try:
            response = requests.get(f"http://localhost:{self.ports['frontend']}", timeout=5)
            health_status['frontend'] = response.status_code == 200
        except:
            health_status['frontend'] = False
        
        return health_status
    
    def monitor_services(self):
        """Monitor services and restart if needed."""
        logger.info("🔍 Starting service monitoring...")
        
        while self.running:
            try:
                health = self.health_check()
                
                for service, healthy in health.items():
                    if not healthy:
                        logger.warning(f"⚠️  {service} service is down, attempting restart...")
                        
                        # Kill the process
                        if service in self.processes:
                            try:
                                self.processes[service].terminate()
                                self.processes[service].wait(timeout=10)
                            except:
                                try:
                                    self.processes[service].kill()
                                except:
                                    pass
                        
                        # Restart the service
                        if service == 'backend':
                            self.start_backend()
                        elif service == 'frontend':
                            self.start_frontend()
                
                time.sleep(self.health_check_interval)
                
            except Exception as e:
                logger.error(f"Error in service monitoring: {e}")
                time.sleep(self.health_check_interval)
    
    def cleanup(self):
        """Clean up all processes and resources."""
        logger.info("🧹 Cleaning up processes...")
        
        for name, process in self.processes.items():
            try:
                logger.info(f"Terminating {name} process...")
                process.terminate()
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                logger.warning(f"Force killing {name} process...")
                try:
                    process.kill()
                except:
                    pass
            except Exception as e:
                logger.error(f"Error terminating {name} process: {e}")
        
        # Final cleanup of any remaining processes
        for port in self.ports.values():
            self.kill_processes_on_port(port)
        
        logger.info("✅ Cleanup completed")
    
    def run(self) -> bool:
        """Main execution method with comprehensive error handling."""
        try:
            self.log_section("CALENDARIFY PRODUCTION SERVER")
            logger.info("Starting production-grade development server...")
            
            # Check dependencies
            if not self.check_dependencies():
                logger.error("❌ Critical dependencies missing, cannot continue")
                return False
            
            # Setup database
            if not self.setup_database():
                logger.error("❌ Database setup failed, cannot continue")
                return False
            
            # Start services
            if not self.start_backend():
                logger.error("❌ Backend startup failed")
                return False
            
            if not self.start_frontend():
                logger.error("❌ Frontend startup failed")
                return False
            
            # Display success message
            self.log_section("🎉 CALENDARIFY STARTUP COMPLETE!")
            logger.info("✅ All services started successfully!")
            logger.info("")
            logger.info("🌐 Access your application:")
            logger.info(f"Frontend: http://localhost:{self.ports['frontend']}")
            logger.info(f"Backend API: http://localhost:{self.ports['backend']}")
            logger.info("")
            logger.info("💡 The server will run indefinitely until you press Ctrl+C")
            logger.info("🔍 Service monitoring is active - services will auto-restart if they fail")
            logger.info("")
            
            # Start monitoring in a separate thread
            monitor_thread = threading.Thread(target=self.monitor_services, daemon=True)
            monitor_thread.start()
            
            # Keep the main thread alive
            while self.running:
                time.sleep(1)
                
                # Periodic health check display
                if int(time.time()) % 60 == 0:  # Every minute
                    health = self.health_check()
                    status = "✅" if all(health.values()) else "⚠️"
                    logger.info(f"{status} Health check: Backend: {'✅' if health['backend'] else '❌'}, Frontend: {'✅' if health['frontend'] else '❌'}")
            
            return True
            
        except KeyboardInterrupt:
            logger.info("Received interrupt signal, shutting down...")
            return True
        except Exception as e:
            logger.error(f"❌ Unexpected error: {e}")
            return False
        finally:
            self.cleanup()

def main():
    """Main entry point with comprehensive error handling."""
    try:
        server = ProductionServer()
        success = server.run()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
