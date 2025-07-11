#!/usr/bin/env python3
"""
Simple examples of different ways to interact with Calendarify user data.
"""

import psycopg2
import json
import csv
from datetime import datetime

# Database connection
DB_URL = "postgresql://heinebautz@localhost:5432/calendarify"

def example_1_basic_read():
    """Example 1: Basic read operations"""
    print("📖 Example 1: Basic Read Operations")
    print("-" * 40)
    
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    
    # Get all users
    cursor.execute('SELECT id, email, name FROM "User"')
    users = cursor.fetchall()
    
    print(f"Found {len(users)} users:")
    for user in users:
        print(f"  - {user[2]} ({user[1]})")
    
    cursor.close()
    conn.close()

def example_2_json_export():
    """Example 2: Export users to JSON"""
    print("\n📄 Example 2: Export to JSON")
    print("-" * 40)
    
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, email, name, created_at FROM "User"')
    users = []
    for row in cursor.fetchall():
        users.append({
            'id': row[0],
            'email': row[1],
            'name': row[2],
            'created_at': row[3].isoformat() if row[3] else None
        })
    
    # Save to JSON file
    with open('users_export.json', 'w') as f:
        json.dump(users, f, indent=2)
    
    print(f"✅ Exported {len(users)} users to users_export.json")
    
    cursor.close()
    conn.close()

def example_3_csv_export():
    """Example 3: Export users to CSV"""
    print("\n📊 Example 3: Export to CSV")
    print("-" * 40)
    
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, email, name, created_at FROM "User"')
    users = cursor.fetchall()
    
    # Save to CSV file
    with open('users_export.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['ID', 'Email', 'Name', 'Created At'])
        for user in users:
            writer.writerow([
                user[0],
                user[1],
                user[2],
                user[3].isoformat() if user[3] else ''
            ])
    
    print(f"✅ Exported {len(users)} users to users_export.csv")
    
    cursor.close()
    conn.close()

def example_4_filter_and_search():
    """Example 4: Filter and search users"""
    print("\n🔍 Example 4: Filter and Search")
    print("-" * 40)
    
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    
    # Search for users with 'test' in email
    cursor.execute('SELECT email, name FROM "User" WHERE email ILIKE %s', ('%test%',))
    test_users = cursor.fetchall()
    
    print(f"Users with 'test' in email ({len(test_users)} found):")
    for user in test_users:
        print(f"  - {user[1]} ({user[0]})")
    
    # Get users created in the last 24 hours
    cursor.execute('SELECT email, name, created_at FROM "User" WHERE created_at >= NOW() - INTERVAL \'24 hours\'')
    recent_users = cursor.fetchall()
    
    print(f"\nUsers created in last 24 hours ({len(recent_users)} found):")
    for user in recent_users:
        print(f"  - {user[1]} ({user[0]}) - {user[2]}")
    
    cursor.close()
    conn.close()

def example_5_bulk_operations():
    """Example 5: Bulk operations"""
    print("\n⚡ Example 5: Bulk Operations")
    print("-" * 40)
    
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    
    # Get user count by domain
    cursor.execute("""
        SELECT 
            SPLIT_PART(email, '@', 2) as domain,
            COUNT(*) as user_count
        FROM "User" 
        GROUP BY SPLIT_PART(email, '@', 2)
        ORDER BY user_count DESC
    """)
    
    domains = cursor.fetchall()
    print("Users by email domain:")
    for domain, count in domains:
        print(f"  - {domain}: {count} users")
    
    cursor.close()
    conn.close()

def example_6_data_analysis():
    """Example 6: Simple data analysis"""
    print("\n📈 Example 6: Data Analysis")
    print("-" * 40)
    
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    
    # Get various statistics
    cursor.execute('SELECT COUNT(*) FROM "User"')
    total_users = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM "User" WHERE name IS NOT NULL')
    users_with_names = cursor.fetchone()[0]
    
    cursor.execute('SELECT MIN(created_at), MAX(created_at) FROM "User"')
    date_range = cursor.fetchone()
    
    print(f"Total users: {total_users}")
    print(f"Users with names: {users_with_names}")
    print(f"Name completion rate: {(users_with_names/total_users)*100:.1f}%")
    print(f"Date range: {date_range[0]} to {date_range[1]}")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    print("🚀 Calendarify User Data Examples")
    print("=" * 50)
    
    try:
        example_1_basic_read()
        example_2_json_export()
        example_3_csv_export()
        example_4_filter_and_search()
        example_5_bulk_operations()
        example_6_data_analysis()
        
        print("\n✅ All examples completed successfully!")
        print("\n📁 Generated files:")
        print("  - users_export.json (JSON format)")
        print("  - users_export.csv (CSV format)")
        
    except Exception as e:
        print(f"❌ Error: {e}") 