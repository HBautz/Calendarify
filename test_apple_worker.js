// Headless Apple Calendar tester based on the integration logic
const APPLE_EMAIL = process.env.APPLE_EMAIL || 'your_email@example.com';
const APPLE_PASSWORD = process.env.APPLE_PASSWORD || 'your_app_specific_password';

const auth = 'Basic ' + Buffer.from(`${APPLE_EMAIL}:${APPLE_PASSWORD}`).toString('base64');
const headers = {
  Depth: '0',
  Authorization: auth,
  'Content-Type': 'application/xml',
  'User-Agent': 'calendarify-caldav-test',
  Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
};

async function getPrincipalUrl() {
  console.log('[DEBUG] Fetching principal URL...');
  const bodyRoot =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<propfind xmlns="DAV:">\n' +
    '  <prop><current-user-principal/></prop>\n' +
    '</propfind>';
  const res = await fetch('https://caldav.icloud.com/', {
    method: 'PROPFIND',
    headers,
    body: bodyRoot,
  });
  console.log(`[DEBUG] Principal PROPFIND status: ${res.status}`);
  if (res.status !== 207) return null;
  const text = await res.text();
  const m = text.match(/<[^>]*current-user-principal[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
  if (!m) return null;
  let url = m[1].trim();
  if (url.startsWith('/')) url = 'https://caldav.icloud.com' + url;
  return url;
}

async function getCalendarHomeUrl(principalUrl) {
  console.log('[DEBUG] Fetching calendar home URL...');
  const bodyPrincipal =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">\n' +
    '  <prop><cal:calendar-home-set/></prop>\n' +
    '</propfind>';
  const res = await fetch(principalUrl, {
    method: 'PROPFIND',
    headers,
    body: bodyPrincipal,
  });
  console.log(`[DEBUG] Calendar home PROPFIND status: ${res.status}`);
  if (res.status !== 207) return null;
  const text = await res.text();
  const m = text.match(/<[^>]*calendar-home-set[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
  if (!m) return null;
  let url = m[1].trim();
  if (url.startsWith('/')) url = 'https://caldav.icloud.com' + url;
  return url;
}

async function listCalendars(calendarHomeUrl) {
  console.log('[DEBUG] Listing calendars...');
  const bodyCals =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<propfind xmlns="DAV:">\n' +
    '  <prop><displayname/></prop>\n' +
    '</propfind>';
  const res = await fetch(calendarHomeUrl, {
    method: 'PROPFIND',
    headers: { ...headers, Depth: '1' },
    body: bodyCals,
  });
  console.log(`[DEBUG] Calendar list PROPFIND status: ${res.status}`);
  if (res.status !== 207) return [];
  const text = await res.text();
  const cals = [];
  const regex = /<response[^>]*>.*?<href>([^<]+)<\/href>.*?<displayname[^>]*>([^<]*)<\/displayname>/gs;
  let m;
  while ((m = regex.exec(text))) {
    cals.push({ href: m[1], name: m[2] });
  }
  return cals;
}

function getWeekRange() {
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n) => n.toString().padStart(2, '0');
  const fmt = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  return { start: fmt(now), end: fmt(week) };
}

function parseICalEvent(ical) {
  const summary = ical.match(/SUMMARY:(.*)/)?.[1];
  const dtstart = ical.match(/DTSTART[^:]*:(.*)/)?.[1];
  const dtend = ical.match(/DTEND[^:]*:(.*)/)?.[1];
  return { summary, dtstart, dtend };
}

async function main() {
  try {
    const principalUrl = await getPrincipalUrl();
    if (!principalUrl) {
      console.error('Could not get principal URL');
      process.exit(1);
    }
    const calendarHomeUrl = await getCalendarHomeUrl(principalUrl);
    if (!calendarHomeUrl) {
      console.error('Could not get calendar home URL');
      process.exit(1);
    }
    const calendars = await listCalendars(calendarHomeUrl);
    console.log('Calendars:');
    for (const cal of calendars) {
      console.log(`- ${cal.name} (${cal.href})`);
    }
    const { start, end } = getWeekRange();
    for (const cal of calendars) {
      const skip = ['inbox', 'outbox', 'notification', '', 'calendars/'].some(
        (s) => cal.name.trim().toLowerCase() === s || cal.href.endsWith(s),
      );
      console.log(`[DEBUG] Calendar: '${cal.name}' | skip: ${skip}`);
      const bodyEvents =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<c:calendar-query xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">\n' +
        '  <d:prop>\n' +
        '    <d:getetag/>\n' +
        '    <c:calendar-data/>\n' +
        '  </d:prop>\n' +
        '  <c:filter>\n' +
        '    <c:comp-filter name="VCALENDAR">\n' +
        '      <c:comp-filter name="VEVENT">\n' +
        `        <c:time-range start="${start}" end="${end}"/>\n` +
        '      </c:comp-filter>\n' +
        '    </c:comp-filter>\n' +
        '  </c:filter>\n' +
        '</c:calendar-query>';
      const url = cal.href.startsWith('/') ? 'https://caldav.icloud.com' + cal.href : cal.href;
      let res, text;
      try {
        res = await fetch(url, {
          method: 'REPORT',
          headers: { ...headers, Depth: '1' },
          body: bodyEvents,
        });
        text = await res.text();
        console.log(`[DEBUG] REPORT status for calendar '${cal.name}': ${res.status}`);
        console.log(`[DEBUG] Raw REPORT response for calendar '${cal.name}':\n`);
        console.log(text);
      } catch (err) {
        console.error(`[ERROR] Fetch/report failed for calendar '${cal.name}':`, err);
        continue;
      }
      const events = [];
      const regex = /<([a-zA-Z0-9:]*calendar-data)[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/\1>/g;
      let m;
      while ((m = regex.exec(text))) {
        events.push(m[2].trim());
      }
      if (!events.length) {
        console.log('  No events found.');
        continue;
      }
      for (const event of events) {
        const parsed = parseICalEvent(event);
        console.log(`  - ${parsed.summary || 'No summary'} | Start: ${parsed.dtstart || '?' } | End: ${parsed.dtend || '?'}`);
      }
    }
    console.log('OK');
  } catch (err) {
    console.error('[FATAL ERROR]', err);
    process.exit(1);
  }
}

main();
