#!/usr/bin/env python3
"""
Example script showing how to interact with Calendarify user data
using Python and PostgreSQL.
"""

import psycopg2
import json
from datetime import datetime
from typing import List, Dict, Optional

class CalendarifyUserManager:
    def __init__(self, db_url: str = "postgresql://heinebautz@localhost:5432/calendarify"):
        """Initialize connection to the Calendarify database."""
        self.db_url = db_url
        self.conn = None
    
    def connect(self):
        """Establish database connection."""
        try:
            self.conn = psycopg2.connect(self.db_url)
            print("✅ Connected to Calendarify database")
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            raise
    
    def disconnect(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            print("🔌 Disconnected from database")
    
    def get_all_users(self) -> List[Dict]:
        """Get all users from the database."""
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, email, name, created_at, updated_at 
            FROM "User" 
            ORDER BY created_at DESC
        """)
        
        users = []
        for row in cursor.fetchall():
            users.append({
                'id': row[0],
                'email': row[1],
                'name': row[2],
                'created_at': row[3].isoformat() if row[3] else None,
                'updated_at': row[4].isoformat() if row[4] else None
            })
        
        cursor.close()
        return users
    
    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Get a specific user by email."""
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, email, name, created_at, updated_at 
            FROM "User" 
            WHERE email = %s
        """, (email,))
        
        row = cursor.fetchone()
        cursor.close()
        
        if row:
            return {
                'id': row[0],
                'email': row[1],
                'name': row[2],
                'created_at': row[3].isoformat() if row[3] else None,
                'updated_at': row[4].isoformat() if row[4] else None
            }
        return None
    
    def create_user(self, email: str, name: str, password: str) -> Dict:
        """Create a new user."""
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        
        # In a real application, you'd hash the password
        # For this example, we'll use a simple hash
        import hashlib
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        
        cursor.execute("""
            INSERT INTO "User" (email, name, password)
            VALUES (%s, %s, %s)
            RETURNING id, email, name, created_at, updated_at
        """, (email, name, hashed_password))
        
        row = cursor.fetchone()
        self.conn.commit()
        cursor.close()
        
        return {
            'id': row[0],
            'email': row[1],
            'name': row[2],
            'created_at': row[3].isoformat() if row[3] else None,
            'updated_at': row[4].isoformat() if row[4] else None
        }
    
    def update_user(self, user_id: str, **kwargs) -> Optional[Dict]:
        """Update user information."""
        if not self.conn:
            self.connect()
        
        # Build dynamic update query
        valid_fields = ['email', 'name']
        update_fields = []
        values = []
        
        for field, value in kwargs.items():
            if field in valid_fields:
                update_fields.append(f'{field} = %s')
                values.append(value)
        
        if not update_fields:
            print("❌ No valid fields to update")
            return None
        
        values.append(user_id)
        
        cursor = self.conn.cursor()
        cursor.execute(f"""
            UPDATE "User" 
            SET {', '.join(update_fields)}, updated_at = NOW()
            WHERE id = %s
            RETURNING id, email, name, created_at, updated_at
        """, values)
        
        row = cursor.fetchone()
        if row:
            self.conn.commit()
            cursor.close()
            return {
                'id': row[0],
                'email': row[1],
                'name': row[2],
                'created_at': row[3].isoformat() if row[3] else None,
                'updated_at': row[4].isoformat() if row[4] else None
            }
        
        cursor.close()
        return None
    
    def delete_user(self, user_id: str) -> bool:
        """Delete a user by ID."""
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM \"User\" WHERE id = %s", (user_id,))
        deleted = cursor.rowcount > 0
        self.conn.commit()
        cursor.close()
        
        return deleted
    
    def get_user_stats(self) -> Dict:
        """Get statistics about users."""
        if not self.conn:
            self.connect()
        
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM \"User\"")
        total_users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM \"User\" WHERE created_at >= NOW() - INTERVAL '7 days'")
        new_users_week = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM \"User\" WHERE created_at >= NOW() - INTERVAL '30 days'")
        new_users_month = cursor.fetchone()[0]
        
        cursor.close()
        
        return {
            'total_users': total_users,
            'new_users_week': new_users_week,
            'new_users_month': new_users_month
        }

def main():
    """Example usage of the CalendarifyUserManager."""
    print("🚀 Calendarify User Data Manager")
    print("=" * 40)
    
    # Initialize the manager
    manager = CalendarifyUserManager()
    
    try:
        # Connect to database
        manager.connect()
        
        # Get all users
        print("\n📋 Current Users:")
        users = manager.get_all_users()
        for user in users:
            print(f"  - {user['name']} ({user['email']}) - Created: {user['created_at']}")
        
        # Get user statistics
        print("\n📊 User Statistics:")
        stats = manager.get_user_stats()
        print(f"  Total users: {stats['total_users']}")
        print(f"  New users this week: {stats['new_users_week']}")
        print(f"  New users this month: {stats['new_users_month']}")
        
        # Example: Get specific user
        print("\n🔍 Looking up admin user:")
        admin_user = manager.get_user_by_email("admin@admin.com")
        if admin_user:
            print(f"  Found: {admin_user['name']} (ID: {admin_user['id']})")
        
        # Example: Create a new user (commented out to avoid duplicates)
        # print("\n➕ Creating new user:")
        # new_user = manager.create_user("test@python.com", "Python Test User", "password123")
        # print(f"  Created: {new_user['name']} ({new_user['email']})")
        
        # Example: Update user (commented out to avoid changes)
        # print("\n✏️ Updating user:")
        # updated = manager.update_user(admin_user['id'], name="Admin Updated")
        # if updated:
        #     print(f"  Updated: {updated['name']}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        manager.disconnect()

if __name__ == "__main__":
    main() 