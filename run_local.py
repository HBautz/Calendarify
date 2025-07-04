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


def ensure_env_file():
    if not os.path.exists('.env') and os.path.exists('.env.example'):
        shutil.copy('.env.example', '.env')
        print('Created .env from .env.example')


def main():
    ensure_env_file()

    run('npm install')

    run('docker compose up -d')

    try:
        run('npm start')
    finally:
        run('docker compose down')


if __name__ == '__main__':
    main()
