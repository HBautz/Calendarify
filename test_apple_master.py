#!/usr/bin/env python3
"""Simple headless Apple Calendar connection test."""

import subprocess
import sys
import os

# DEFINE YOUR CREDENTIALS HERE
APPLE_EMAIL = "your_email@example.com"  # TODO: replace
APPLE_PASSWORD = "your_app_specific_password"  # TODO: replace

NODE_SCRIPT = "test_apple_worker.js"


def run_worker(email: str, password: str) -> str:
    """Run the Node.js worker and return its stdout."""
    env = os.environ.copy()
    env["APPLE_EMAIL"] = email
    env["APPLE_PASSWORD"] = password
    try:
        result = subprocess.run(
            ["node", NODE_SCRIPT],
            check=False,
            capture_output=True,
            text=True,
            env=env,
        )
        if result.stderr:
            print("[DEBUG] worker stderr:", result.stderr.strip())
        return result.stdout.strip()
    except FileNotFoundError:
        print("Node.js is not installed or not found in PATH.")
        sys.exit(1)


def main():
    print("[DEBUG] Starting Apple Calendar headless test...")
    status = run_worker(APPLE_EMAIL, APPLE_PASSWORD)
    print("[DEBUG] Worker result:", status)
    if status == "OK":
        print("Success! Credentials are valid.")
    elif status == "INVALID":
        print("Authorization failed: Check your Apple ID email and app-specific password.")
    elif status == "UNREACHABLE":
        print("Unable to reach Apple CalDAV service.")
    else:
        print("Unexpected result:", status)


if __name__ == "__main__":
    main()
