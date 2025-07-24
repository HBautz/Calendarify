import requests
from requests.auth import HTTPBasicAuth
from datetime import datetime, timedelta
import re

APPLE_EMAIL = "heine@dragnordre.no"  # TODO: replace
APPLE_PASSWORD = "rjmd-wyzi-vplm-ojcf"  # TODO: replace

session = requests.Session()
session.auth = HTTPBasicAuth(APPLE_EMAIL, APPLE_PASSWORD)
headers = {
    "Depth": "0",
    "Content-Type": "application/xml",
    "User-Agent": "calendarify-caldav-test",
    "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.8"
}

# 1. Root PROPFIND to get principal URL
body_root = '''<?xml version="1.0" encoding="UTF-8"?>
<propfind xmlns="DAV:">
  <prop><current-user-principal/></prop>
</propfind>'''

root_url = "https://caldav.icloud.com/"
res = session.request("PROPFIND", root_url, headers=headers, data=body_root)
if res.status_code in (401, 403, 404):
    print("INVALID")
    exit(1)
if res.status_code != 207:
    print("UNREACHABLE")
    exit(1)

m = re.search(r'<[^>]*current-user-principal[^>]*>\s*<[^>]*href[^>]*>([^<]+)</[^>]*href>', res.text, re.I)
if not m:
    print("UNREACHABLE")
    exit(1)
principal_url = m.group(1).strip()
if principal_url.startswith("/"):
    principal_url = "https://caldav.icloud.com" + principal_url

# 2. PROPFIND to principal URL to get calendar-home-set
body_principal = '''<?xml version="1.0" encoding="UTF-8"?>
<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <prop><cal:calendar-home-set/></prop>
</propfind>'''

res = session.request("PROPFIND", principal_url, headers=headers, data=body_principal)
if res.status_code in (401, 403, 404):
    print("INVALID")
    exit(1)
if res.status_code != 207:
    print("UNREACHABLE")
    exit(1)

m = re.search(r'<[^>]*calendar-home-set[^>]*>\s*<[^>]*href[^>]*>([^<]+)</[^>]*href>', res.text, re.I)
if not m:
    print("UNREACHABLE")
    exit(1)
calendar_home_url = m.group(1).strip()
if calendar_home_url.startswith("/"):
    calendar_home_url = "https://caldav.icloud.com" + calendar_home_url

# 3. PROPFIND to calendar home to list all calendars
body_cals = '''<?xml version="1.0" encoding="UTF-8"?>
<propfind xmlns="DAV:">
  <prop><displayname/></prop>
</propfind>'''

res = session.request("PROPFIND", calendar_home_url, headers={**headers, "Depth": "1"}, data=body_cals)
if res.status_code != 207:
    print("UNREACHABLE")
    exit(1)

# Debug: print the raw XML response
print("\n[DEBUG] Raw calendar home PROPFIND response:\n")
print(res.text)

# Parse calendars
calendars = []
for m in re.finditer(r'<response[^>]*>.*?<href>([^<]+)</href>.*?<displayname[^>]*>([^<]*)</displayname>', res.text, re.DOTALL):
    href, name = m.group(1), m.group(2)
    calendars.append({"href": href, "name": name})

print("OK")
print("Principal URL:", principal_url)
print("Calendar Home URL:", calendar_home_url)
print("Calendars:")
for cal in calendars:
    print(f"- {cal['name']} ({cal['href']})")

# Filter out system folders and containers
skip_names = {"inbox", "outbox", "notification", ""}
filtered_calendars = [
    cal for cal in calendars
    if cal["name"].strip().lower() not in skip_names and not cal["href"].endswith("/calendars/")
]

# 4. For each calendar, fetch events in the coming week
start = datetime.utcnow()
end = start + timedelta(days=7)
start_str = start.strftime("%Y%m%dT%H%M%SZ")
end_str = end.strftime("%Y%m%dT%H%M%SZ")

body_events = f'''<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="{start_str}" end="{end_str}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>'''

for i, cal in enumerate(filtered_calendars):
    cal_url = cal["href"]
    if cal_url.startswith("/"):
        cal_url = "https://caldav.icloud.com" + cal_url
    res = session.request("REPORT", cal_url, headers={**headers, "Depth": "1"}, data=body_events)
    print(f"\nEvents for calendar: {cal['name']} ({cal['href']})")
    if cal["name"].strip().lower() == "hjem":
        print("\n[DEBUG] Raw REPORT response for 'Hjem' calendar:\n")
        print(res.text)
    if res.status_code != 207:
        print("  Could not fetch events.")
        continue
    # Print raw iCalendar data for each event
    for event in re.findall(r'<cal:calendar-data[^>]*>([\s\S]*?)</cal:calendar-data>', res.text):
        print("  --- Event ---")
        print(event.strip())