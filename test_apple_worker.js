const https = require('https');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node test_apple_worker.js <email> <app-password>');
  process.exit(1);
}

const options = {
  hostname: 'caldav.icloud.com',
  port: 443,
  path: '/',
  method: 'PROPFIND',
  headers: {
    'Authorization': 'Basic ' + Buffer.from(email + ':' + password).toString('base64'),
    'Depth': '0',
    'Content-Type': 'application/xml',
    'User-Agent': 'calendarify-caldav-test',
    'Accept': 'application/xml,text/xml;q=0.9,*/*;q=0.8'
  }
};

const req = https.request(options, (res) => {
  if (res.statusCode === 401) {
    console.log('INVALID');
    return;
  }
  if (res.statusCode !== 207) {
    console.log('UNREACHABLE');
    return;
  }
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('OK');
  });
});

req.on('error', (e) => {
  console.log('ERROR', e.message || e);
});

req.write(
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<propfind xmlns="DAV:">\n' +
  '  <prop><current-user-principal/></prop>\n' +
  '</propfind>'
);
req.end();
