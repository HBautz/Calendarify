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


def setup_database():
    os.chdir('backend')
    
    # Update DATABASE_URL to use current user instead of 'postgres'
    env_file = '.env'
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            content = f.read()
        
        # Replace postgres user with current user
        import getpass
        current_user = getpass.getuser()
        content = content.replace('postgres:postgres@', f'{current_user}@')
        
        with open(env_file, 'w') as f:
            f.write(content)
        print(f'Updated DATABASE_URL to use user: {current_user}')
    
    # Try to create database if it doesn't exist
    try:
        run('createdb calendarify')
        print('Created database: calendarify')
    except SystemExit:
        print('Database may already exist or creation failed')
    
    # Try to push schema
    try:
        run('npx prisma db push')
        print('Database schema updated successfully')
    except SystemExit as e:
        print(f'Failed to push schema: {e}')
        # Try alternative approach - create database with current user
        try:
            run('dropdb calendarify --if-exists')
            run('createdb calendarify')
            run('npx prisma db push')
            print('Database schema updated successfully (retry)')
        except SystemExit:
            print('❌ Database setup failed. Please check PostgreSQL configuration.')
            sys.exit(1)
    
    os.chdir('..')


def start_backend():
    def _run():
        os.chdir('backend')
        run('npm install')
        run('npm start')
    t = Thread(target=_run)
    t.daemon = True
    t.start()
    # Wait for backend to start
    for _ in range(30):
        try:
            import requests
            r = requests.get('http://localhost:3001/api')
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
        # Make sure we're in the project root directory
        os.chdir('/Users/heinebautz/portfolio-github/Calendarify')
        # Use the custom server.js that handles clean URLs
        run('node server.js')
    t = Thread(target=_run)
    t.daemon = True
    t.start()
    # Wait for server
    for _ in range(15):
        try:
            import requests
            r = requests.get('http://localhost:3000')
            if r.status_code == 200:
                print('Frontend is up!')
                return
        except Exception:
            pass
        time.sleep(1)
    print('Warning: Frontend may not have started yet.')


def main():
    ensure_env_file('.')
    ensure_env_file('backend')
    ensure_backend_env()
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
    start_backend()
    serve_frontend()
    print("\nOpening http://localhost:3000/log-in in your browser...")
    webbrowser.open('http://localhost:3000/log-in')
    print("\nAll services started! Press Ctrl+C to stop.")
    while True:
        time.sleep(60)


if __name__ == '__main__':
    main()
