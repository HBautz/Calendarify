#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys
import time
import webbrowser
from threading import Thread


def run(cmd, **kwargs):
    print(f"\n$ {cmd}")
    result = subprocess.run(cmd, shell=True, **kwargs)
    if result.returncode != 0:
        sys.exit(result.returncode)


def run_bg(cmd):
    print(f"\n$ {cmd} (background)")
    return subprocess.Popen(cmd, shell=True)


def check_docker():
    try:
        subprocess.run(['docker', '--version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def check_homebrew():
    try:
        subprocess.run(['brew', '--version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def ensure_node_version(required_major=20):
    """Ensure Node.js of the required major version is available."""
    try:
        output = subprocess.check_output(['node', '--version'], text=True).strip()
        current_major = int(output.lstrip('v').split('.')[0])
    except Exception:
        current_major = None
    if current_major == required_major:
        print(f"✓ Node.js {output} detected")
        return

    print(f"\n⚠️  Node.js {required_major}.x required, but version {output if current_major else 'not found'} detected")
    installed = False

    if shutil.which('nvm'):
        try:
            run('nvm install 20')
            run('nvm use 20')
            installed = True
        except SystemExit:
            installed = False
    elif check_homebrew():
        try:
            run('brew install node@20')
            run('brew link --overwrite --force node@20')
            installed = True
        except SystemExit:
            installed = False

    if installed:
        try:
            output = subprocess.check_output(['node', '--version'], text=True).strip()
            if output.startswith(f'v{required_major}'):
                print(f"✓ Node.js {output} is now active")
                return
        except Exception:
            pass

    print('❌ Failed to ensure the correct Node.js version. Please install Node.js 20 manually.')
    sys.exit(1)


def check_services():
    """Check if required services are available locally"""
    services = {
        'PostgreSQL': 'psql --version',
        'Redis': 'redis-server --version'
    }
    
    missing = []
    for service, cmd in services.items():
        try:
            subprocess.run(cmd.split(), capture_output=True, check=True)
            print(f"✓ {service} is available")
        except (subprocess.CalledProcessError, FileNotFoundError):
            missing.append(service)
            print(f"✗ {service} is not available")
    
    return missing


def install_and_start_services(missing_services):
    if not check_homebrew():
        print("\n❌ Homebrew is not installed. Please install Homebrew first: https://brew.sh/")
        sys.exit(1)
    for service in missing_services:
        if service == 'PostgreSQL':
            print("\nInstalling PostgreSQL with Homebrew...")
            run('brew install postgresql')
            print("Starting PostgreSQL service...")
            run('brew services start postgresql')
        elif service == 'Redis':
            print("\nInstalling Redis with Homebrew...")
            run('brew install redis')
            print("Starting Redis service...")
            run('brew services start redis')


def ensure_env_file(path='.'):
    env = os.path.join(path, '.env')
    env_example = os.path.join(path, '.env.example')
    if not os.path.exists(env) and os.path.exists(env_example):
        shutil.copy(env_example, env)
        print(f'Created {env} from {env_example}')


def ensure_backend_env():
    # Copy root .env to backend if not present
    if not os.path.exists('backend/.env') and os.path.exists('.env'):
        shutil.copy('.env', 'backend/.env')
        print('Copied .env to backend/.env')


def update_database_url(env_path):
    """Replace default postgres credentials with current user and reload env."""
    if not os.path.exists(env_path):
        return

    with open(env_path, 'r') as f:
        content = f.read()

    import getpass
    current_user = getpass.getuser()
    new_content = content.replace('postgres:postgres@', f'{current_user}@')

    if new_content != content:
        with open(env_path, 'w') as f:
            f.write(new_content)
        print(f'Updated DATABASE_URL in {env_path} to use user: {current_user}')

    for line in new_content.splitlines():
        if line.startswith('DATABASE_URL='):
            os.environ['DATABASE_URL'] = line.split('=', 1)[1]
            break


def load_env_files():
    """Load environment variables from .env files"""
    for env_path in ['.env', 'backend/.env']:
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#') or '=' not in line:
                        continue
                    key, val = line.split('=', 1)
                    os.environ.setdefault(key, val)


def check_apple_calendar():
    """Attempt a simple CalDAV request to verify Apple Calendar connectivity"""
    email = os.environ.get('APPLE_EMAIL')
    password = os.environ.get('APPLE_PASSWORD')
    if not email or not password:
        print('Apple Calendar: False (credentials not set)')
        return False

    try:
        import requests
        body = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<propfind xmlns="DAV:">\n  <prop><current-user-principal/>'
            '</prop>\n</propfind>'
        )
        res = requests.request(
            'PROPFIND',
            'https://caldav.icloud.com/',
            headers={'Depth': '0'},
            auth=(email, password),
            data=body,
            timeout=10,
        )
        ok = res.status_code == 207
        print(f'Apple Calendar: {ok}')
        return ok
    except Exception as e:
        print(f'Apple Calendar: False ({e})')
        return False


def setup_database():
    os.chdir('backend')
    
    # Try to create database if it doesn't exist
    try:
        run('createdb calendarify')
        print('Created database: calendarify')
    except SystemExit:
        print('Database may already exist or creation failed')
    
    # Try to push schema
    try:
        run('npx prisma db push', env=os.environ.copy())
        print('Database schema updated successfully')
    except SystemExit as e:
        print(f'Failed to push schema: {e}')
        # Try alternative approach - create database with current user
        try:
            run('dropdb calendarify --if-exists')
            run('createdb calendarify')
            run('npx prisma db push', env=os.environ.copy())
            print('Database schema updated successfully (retry)')
        except SystemExit:
            print('❌ Database setup failed. Please check PostgreSQL configuration.')
            sys.exit(1)
    
    os.chdir('..')


def seed_default_admin():
    """Ensure a default admin user exists for local login."""
    script_path = os.path.join('backend', 'scripts', 'seed_admin.js')
    if os.path.exists(script_path):
        run(f'node {script_path}', env=os.environ.copy())
    else:
        print('Seed script not found, skipping admin user seeding')


def kill_existing_services():
    """Kill any existing services that might be using our ports"""
    import subprocess
    import signal
    
    print("Checking for existing services...")
    
    def kill_processes_on_port(port, max_retries=3):
        """Kill processes on a specific port with retry logic"""
        for attempt in range(max_retries):
            try:
                # First, try to kill any NestJS processes that might be using the port
                if port == 3001:
                    try:
                        print(f"Killing any NestJS processes (attempt {attempt + 1})")
                        subprocess.run(['pkill', '-f', 'nest start'], capture_output=True)
                        subprocess.run(['pkill', '-f', 'npm start'], capture_output=True)
                        time.sleep(2)
                    except Exception as e:
                        print(f"Warning: Could not kill NestJS processes: {e}")
                
                # Check for processes using the port
                result = subprocess.run(['lsof', '-ti:{}'.format(port)], capture_output=True, text=True)
                if result.stdout.strip():
                    pids = result.stdout.strip().split('\n')
                    for pid in pids:
                        if pid:
                            print(f"Killing process {pid} on port {port} (attempt {attempt + 1})")
                            try:
                                # Try graceful termination first
                                os.kill(int(pid), signal.SIGTERM)
                            except ProcessLookupError:
                                # Process already dead
                                continue
                            except Exception as e:
                                print(f"Warning: Could not kill process {pid}: {e}")
                    
                    # Wait for processes to die
                    time.sleep(3)
                    
                    # Check if processes are still running using netstat for more reliable detection
                    try:
                        netstat_result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
                        if netstat_result.returncode == 0:
                            lines = netstat_result.stdout.split('\n')
                            port_in_use = any(f':{port} ' in line and 'LISTEN' in line for line in lines)
                            if port_in_use:
                                print(f"Processes still running on port {port}, trying SIGKILL...")
                                # Try lsof again to get PIDs
                                result = subprocess.run(['lsof', '-ti:{}'.format(port)], capture_output=True, text=True)
                                if result.stdout.strip():
                                    pids = result.stdout.strip().split('\n')
                                    for pid in pids:
                                        if pid:
                                            try:
                                                os.kill(int(pid), signal.SIGKILL)
                                            except ProcessLookupError:
                                                continue
                                            except Exception as e:
                                                print(f"Warning: Could not force kill process {pid}: {e}")
                                time.sleep(2)
                            else:
                                print(f"✓ All processes on port {port} terminated")
                                break
                        else:
                            # Fallback to lsof check
                            result = subprocess.run(['lsof', '-ti:{}'.format(port)], capture_output=True, text=True)
                            if result.stdout.strip():
                                print(f"Processes still running on port {port}, trying SIGKILL...")
                                pids = result.stdout.strip().split('\n')
                                for pid in pids:
                                    if pid:
                                        try:
                                            os.kill(int(pid), signal.SIGKILL)
                                        except ProcessLookupError:
                                            continue
                                        except Exception as e:
                                            print(f"Warning: Could not force kill process {pid}: {e}")
                                time.sleep(2)
                            else:
                                print(f"✓ All processes on port {port} terminated")
                                break
                    except Exception as e:
                        print(f"Warning: Could not check port status: {e}")
                        # Fallback to original lsof check
                        result = subprocess.run(['lsof', '-ti:{}'.format(port)], capture_output=True, text=True)
                        if not result.stdout.strip():
                            print(f"✓ All processes on port {port} terminated")
                            break
                else:
                    print(f"✓ No processes found on port {port}")
                    break
            except Exception as e:
                print(f"Warning: Could not check processes on port {port}: {e}")
                break
    
    # Kill processes on both ports
    kill_processes_on_port(3000)  # frontend
    kill_processes_on_port(3001)  # backend
    
    # Additional wait to ensure ports are fully freed
    print("Waiting for ports to be fully freed...")
    time.sleep(3)
    
    # Verify ports are free using netstat for more reliable detection
    for port in [3000, 3001]:
        try:
            netstat_result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
            if netstat_result.returncode == 0:
                lines = netstat_result.stdout.split('\n')
                port_in_use = any(f':{port} ' in line and 'LISTEN' in line for line in lines)
                if port_in_use:
                    print(f"⚠️  Warning: Port {port} may still be in use")
                else:
                    print(f"✓ Port {port} is free")
            else:
                # Fallback to lsof
                result = subprocess.run(['lsof', '-ti:{}'.format(port)], capture_output=True, text=True)
                if result.stdout.strip():
                    print(f"⚠️  Warning: Port {port} may still be in use")
                else:
                    print(f"✓ Port {port} is free")
        except Exception as e:
            print(f"Warning: Could not verify port {port}: {e}")


def check_port_available(port, max_retries=5):
    """Check if a port is available, with retry logic"""
    for attempt in range(max_retries):
        try:
            # Use netstat as an alternative to lsof for more reliable port checking
            result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
            if result.returncode == 0:
                # Check if port is in LISTEN state
                lines = result.stdout.split('\n')
                port_in_use = any(f':{port} ' in line and 'LISTEN' in line for line in lines)
                if not port_in_use:
                    return True
                print(f"Port {port} still in use (attempt {attempt + 1}/{max_retries}), waiting...")
                time.sleep(2)
            else:
                # Fallback to lsof
                result = subprocess.run(['lsof', '-ti:{}'.format(port)], capture_output=True, text=True)
                if not result.stdout.strip():
                    return True
                print(f"Port {port} still in use (attempt {attempt + 1}/{max_retries}), waiting...")
                time.sleep(2)
        except Exception as e:
            print(f"Warning: Could not check port {port}: {e}")
            # Try one more aggressive cleanup
            try:
                subprocess.run(['pkill', '-f', f':{port}'], capture_output=True)
                time.sleep(1)
            except:
                pass
            return True  # Assume available if we can't check
    return False

def start_backend():
    """Start the backend server in a background thread"""
    def _run():
        try:
            os.chdir('backend')
            print("Starting backend server...")
            # Use Popen to start the process without blocking
            subprocess.Popen('npm run start:dev', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            print(f"Backend startup error: {e}")
    
    t = Thread(target=_run)
    t.daemon = True
    t.start()
    
    # Wait up to 30 seconds for backend to start
    print("Waiting for backend to start (timeout: 30s)...")
    for i in range(30):
        time.sleep(1)
        
        # Check if backend process is running on port 3001
        result = subprocess.run(['lsof', '-ti:3001'], capture_output=True, text=True)
        if result.stdout.strip():
            print(f"✓ Backend process started after {i+1}s")
            return True
        
        # Check if npm/node processes are running (compilation in progress)
        result = subprocess.run(['pgrep', '-f', 'npm run start:dev'], capture_output=True, text=True)
        if result.stdout.strip():
            if i == 0:  # Only show this message once
                print("✓ Backend compilation in progress...")
            continue
    
    print("⚠️  Backend process may not have started yet (timeout reached)")
    return False


def check_service_health():
    """Check if both services are still running"""
    backend_running = subprocess.run(['lsof', '-ti:3001'], capture_output=True, text=True).stdout.strip() != ''
    frontend_running = subprocess.run(['lsof', '-ti:3000'], capture_output=True, text=True).stdout.strip() != ''
    return backend_running, frontend_running

def serve_frontend():
    """Start the frontend server in a background thread"""
    def _run():
        try:
            # Run from the repository root regardless of the caller's cwd
            os.chdir(os.path.dirname(os.path.abspath(__file__)))

            # Ensure the frontend runs on its own port to avoid conflicts with the
            # backend (which uses PORT from the .env file).
            env = os.environ.copy()
            # Force the frontend to run on port 3000 regardless of the PORT value
            # from .env which is used by the backend.
            env['PORT'] = '3000'

            # Use the custom server.js that handles clean URLs
            print("Starting frontend server...")
            subprocess.Popen('node server.js', shell=True, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            print(f"Frontend startup error: {e}")
    
    t = Thread(target=_run)
    t.daemon = True
    t.start()
    
    # Wait up to 10 seconds for frontend to start
    print("Waiting for frontend to start (timeout: 10s)...")
    for i in range(10):
        time.sleep(1)
        
        # Check if frontend process is running
        result = subprocess.run(['lsof', '-ti:3000'], capture_output=True, text=True)
        if result.stdout.strip():
            print(f"✓ Frontend process started after {i+1}s")
            return True
    
    print("⚠️  Frontend process may not have started yet (timeout reached)")
    return False


def main():
    ensure_node_version(20)
    ensure_env_file('.')
    ensure_env_file('backend')
    ensure_backend_env()
    update_database_url('.env')
    update_database_url('backend/.env')
    load_env_files()
    check_apple_calendar()
    run('npm install')

    if check_docker():
        print("\nDocker is available. Starting services with Docker Compose...")
        run('docker compose up -d')
    else:
        print("\nDocker is not available. Checking for local services...")
        missing_services = check_services()
        if missing_services:
            print(f"\nMissing required services: {', '.join(missing_services)}")
            install_and_start_services(missing_services)
            print("\nRechecking services...")
            missing_services = check_services()
            if missing_services:
                print(f"\n❌ Still missing: {', '.join(missing_services)}. Please check installation logs.")
                sys.exit(1)
        print("\n✓ All required services are available locally")

    setup_database()
    # seed_default_admin()  # Removed automatic admin user creation
    
    # Kill any existing services before starting new ones
    kill_existing_services()
    
    # Start services in parallel
    print("\nStarting services...")
    backend_started = start_backend()
    frontend_started = serve_frontend()
    
    print("\n" + "="*50)
    print("🎉 CALENDARIFY STARTUP COMPLETE!")
    print("="*50)
    
    if backend_started and frontend_started:
        print("✓ Both services started successfully!")
    elif backend_started:
        print("✓ Backend started")
        print("⚠️  Frontend may still be starting up...")
    elif frontend_started:
        print("✓ Frontend started")
        print("⚠️  Backend may still be starting up...")
    else:
        print("⚠️  Services may still be starting up...")
    
    print("\n🌐 Access your application:")
    print("Frontend: http://localhost:3000")
    print("Backend API: http://localhost:3001")
    
    if backend_started and frontend_started:
        print("\n✅ Both services are ready!")
        print("💡 You can now access the application.")
    else:
        print("\n⚠️  Some services may still be starting...")
        print("💡 Check the URLs above - they should become available shortly.")
        print("   • Backend typically takes 30-60 seconds to compile")
        print("   • Frontend should be available immediately")
    
    # Determine if we should auto-exit based on service status
    if backend_started and frontend_started:
        print("\n✅ Both services are running successfully!")
        print("💡 The script will keep running to maintain the services.")
        print("   Press Ctrl+C to stop all services when you're done.")
        
        try:
            # Keep running indefinitely since both services started successfully
            # Check service health every 30 seconds
            last_health_check = time.time()
            while True:
                time.sleep(1)
                
                # Periodic health check every 30 seconds
                if time.time() - last_health_check > 30:
                    backend_running, frontend_running = check_service_health()
                    if not backend_running or not frontend_running:
                        print(f"\n⚠️  Service health check failed:")
                        print(f"   Backend: {'✓ Running' if backend_running else '✗ Stopped'}")
                        print(f"   Frontend: {'✓ Running' if frontend_running else '✗ Stopped'}")
                        print("   Services may have crashed. Check the logs for details.")
                    last_health_check = time.time()
        except KeyboardInterrupt:
            pass
    else:
        print("\n⚠️  Some services may still be starting...")
        print("💡 The script will auto-exit after 2 minutes if services don't start.")
        print("   Press Ctrl+C to stop all services.")
        
        try:
            # Auto-exit after 2 minutes only if services failed to start
            start_time = time.time()
            while time.time() - start_time < 120:  # 2 minutes timeout
                time.sleep(1)
            print("\n\nAuto-exiting after 2 minutes (services may not have started)...")
        except KeyboardInterrupt:
            pass
        print("\n\nShutting down services...")
        # Try to gracefully stop services
        try:
            import requests
            requests.post('http://localhost:3001/api/admin/shutdown', timeout=1)
        except:
            pass
        
        # Kill any remaining processes on our ports
        print("Cleaning up any remaining processes...")
        kill_existing_services()
        
        print("✓ Services stopped. Goodbye!")


if __name__ == '__main__':
    main()
