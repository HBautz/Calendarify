import requests
import xml.etree.ElementTree as ET

# Temporary debugging script for Apple Calendar connectivity.
# Enter your Apple ID email and the app-specific password you created in iCloud
# below. The password will only be used for these tests and is not stored.
APPLE_EMAIL = 'your_email@example.com'
APPLE_PASSWORD = 'your_app_specific_password'

BASE_URL = 'https://caldav.icloud.com/'

def propfind(url, body, auth, depth='0'):
    headers = {'Depth': depth, 'Content-Type': 'text/xml'}
    print(f"\n-> PROPFIND {url}")
    resp = requests.request('PROPFIND', url, auth=auth, headers=headers, data=body)
    print(f"<- status {resp.status_code}")
    print(resp.text[:200] + ('...' if len(resp.text) > 200 else ''))
    return resp

def run_tests():
    auth = (APPLE_EMAIL, APPLE_PASSWORD)
    body_root = """<?xml version='1.0' encoding='UTF-8'?>
<propfind xmlns='DAV:'>
  <prop><current-user-principal/></prop>
</propfind>"""
    r = propfind(BASE_URL, body_root, auth)
    if r.status_code != 207:
        print('Root PROPFIND failed. Check credentials.')
        return
    try:
        tree = ET.fromstring(r.text)
        ns = {'D': 'DAV:'}
        principal_href = tree.find('.//D:current-user-principal/D:href', ns).text
    except Exception as e:
        print('Failed to parse principal href:', e)
        return
    principal_url = BASE_URL + principal_href.lstrip('/')
    print('Principal URL:', principal_url)

    body_principal = """<?xml version='1.0' encoding='UTF-8'?>
<propfind xmlns='DAV:' xmlns:cal='urn:ietf:params:xml:ns:caldav'>
  <prop><cal:calendar-home-set/></prop>
</propfind>"""
    r = propfind(principal_url, body_principal, auth)
    if r.status_code != 207:
        print('Principal PROPFIND failed.')
        return
    try:
        tree = ET.fromstring(r.text)
        ns = {'D': 'DAV:', 'cal': 'urn:ietf:params:xml:ns:caldav'}
        home_href = tree.find('.//cal:calendar-home-set/D:href', ns).text
    except Exception as e:
        print('Failed to parse calendar home set:', e)
        return
    calendar_home_url = BASE_URL + home_href.lstrip('/')
    print('Calendar home URL:', calendar_home_url)

    body_cals = """<?xml version='1.0' encoding='UTF-8'?>
<propfind xmlns='DAV:'>
  <prop><displayname/></prop>
</propfind>"""
    r = propfind(calendar_home_url, body_cals, auth, depth='1')
    if r.status_code != 207:
        print('Failed to list calendars.')
        return
    try:
        tree = ET.fromstring(r.text)
        ns = {'D': 'DAV:'}
        calendars = []
        for resp in tree.findall('D:response', ns):
            href = resp.find('D:href', ns)
            name_elem = resp.find('.//D:displayname', ns)
            name = name_elem.text if name_elem is not None else ''
            if href is not None:
                calendars.append((href.text, name))
        print('Calendars:')
        for href, name in calendars:
            print(f'  {name} -> {href}')
    except Exception as e:
        print('Failed to parse calendars:', e)

if __name__ == '__main__':
    run_tests()
