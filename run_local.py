#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys


def run(cmd, **kwargs):
    print(f"\n$ {cmd}")
    result = subprocess.run(cmd, shell=True, **kwargs)
    if result.returncode != 0:
        sys.exit(result.returncode)


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


def ensure_env_file():
    if not os.path.exists('.env') and os.path.exists('.env.example'):
        shutil.copy('.env.example', '.env')
        print('Created .env from .env.example')


def main():
    ensure_env_file()

    run('npm install')

    # Check if Docker is available
    if check_docker():
        print("\nDocker is available. Starting services with Docker Compose...")
        run('docker compose up -d')
        
        try:
            run('npm start')
        finally:
            run('docker compose down')
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
        print("Starting the application...")
        run('npm start')


if __name__ == '__main__':
    main()
