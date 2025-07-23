(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: node test_apple_worker.js <email> <app-password>');
    process.exit(1);
  }
  const auth = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
  const headers = {
    Depth: '0',
    Authorization: auth,
    'Content-Type': 'application/xml',
    'User-Agent': 'calendarify-caldav-test',
    Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8'
  };
  const bodyRoot = '<?xml version="1.0" encoding="UTF-8"?>\n'<
    + '<propfind xmlns="DAV:">\n'<
    + '  <prop><current-user-principal/></prop>\n'</
    + '</propfind>';
  try {
    let res = await fetch('https://caldav.icloud.com/', { method: 'PROPFIND', headers, body: bodyRoot });
    let text = await res.text();
    if ([401,403,404].includes(res.status)) {
      console.log('INVALID');
      return;
    }
    if (res.status !== 207) {
      console.log('UNREACHABLE');
      return;
    }
    const hrefMatch = text.match(/<[^>]*current-user-principal[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
    if (!hrefMatch) {
      console.log('PARSE_FAIL_PRINCIPAL');
      return;
    }
    const principalUrl = 'https://caldav.icloud.com' + hrefMatch[1].trim();
    const bodyPrincipal = '<?xml version="1.0" encoding="UTF-8"?>\n'<
      + '<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">\n'<
      + '  <prop><cal:calendar-home-set/></prop>\n'</
      + '</propfind>';
    res = await fetch(principalUrl, { method: 'PROPFIND', headers, body: bodyPrincipal });
    text = await res.text();
    if ([401,403,404].includes(res.status)) {
      console.log('INVALID');
      return;
    }
    if (res.status !== 207) {
      console.log('UNREACHABLE');
      return;
    }
    const homeMatch = text.match(/<[^>]*calendar-home-set[^>]*>\s*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i);
    if (!homeMatch) {
      console.log('PARSE_FAIL_HOME');
      return;
    }
    console.log('OK');
  } catch (err) {
    console.error('ERROR', err);
  }
})();
