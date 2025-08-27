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
    
    # Kill processes on port 3000 (frontend)
    try:
        result = subprocess.run(['lsof', '-ti:3000'], capture_output=True, text=True)
        if result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                if pid:
                    print(f"Killing process {pid} on port 3000")
                    os.kill(int(pid), signal.SIGTERM)
    except Exception as e:
        print(f"Warning: Could not kill processes on port 3000: {e}")
    
    # Kill processes on port 3001 (backend)
    try:
        result = subprocess.run(['lsof', '-ti:3001'], capture_output=True, text=True)
        if result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                if pid:
                    print(f"Killing process {pid} on port 3001")
                    os.kill(int(pid), signal.SIGTERM)
    except Exception as e:
        print(f"Warning: Could not kill processes on port 3001: {e}")
    
    # Wait a moment for processes to die
    time.sleep(2)


def start_backend():
    def _run():
        try:
            os.chdir('backend')
            run('npm install')
            run('npm start')
        except Exception as e:
            print(f"Backend startup error: {e}")
    t = Thread(target=_run)
    t.daemon = True
    t.start()
    # Wait for backend to start
    for _ in range(30):
        try:
            import requests
            r = requests.get('http://localhost:3001/api', timeout=2)
            if r.status_code == 200 or r.status_code == 404:
                print('Backend is up!')
                return
        except Exception:
            pass
        time.sleep(1)
    print('Warning: Backend may not have started yet.')


def serve_frontend():
    # Use the Node server that comes with the project to serve the static files
    # with extensionless URL support.
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
            run('node server.js', env=env)
        except Exception as e:
            print(f"Frontend startup error: {e}")
    t = Thread(target=_run)
    t.daemon = True
    t.start()
    # Wait for server
    for _ in range(15):
        try:
            import requests
            r = requests.get('http://localhost:3000', timeout=2)
            if r.status_code == 200:
                print('Frontend is up!')
                return
        except Exception:
            pass
        time.sleep(1)
    print('Warning: Frontend may not have started yet.')


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
    
    start_backend()
    serve_frontend()
    print("\nAll services started!")
    print("Backend: http://localhost:3001")
    print("Frontend: http://localhost:3000")
    print("\nPress Ctrl+C to stop all services.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\nShutting down services...")
        # Try to gracefully stop services
        try:
            import requests
            requests.post('http://localhost:3001/api/admin/shutdown', timeout=1)
        except:
            pass
        print("Services stopped. Goodbye!")


if __name__ == '__main__':
    main()
