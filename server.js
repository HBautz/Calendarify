const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = process.env.PORT || 3000;

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

http.createServer((req, res) => {
  // Log incoming request
  console.log(`INCOMING: ${req.method} ${req.url}`);

  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // Special handling for /sign-up and /sign-up/
  if (reqPath === '/sign-up' || reqPath === '/sign-up/') {
    reqPath = '/sign-up/index.html';
  }

  let filePath = path.join(rootDir, reqPath);

  if (!path.extname(filePath)) {
    const dirFile = path.join(filePath, 'index.html');
    if (fs.existsSync(dirFile)) {
      filePath = dirFile;
    } else {
      filePath = filePath + '.html';
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (!err) {
      const ext = path.extname(filePath);
      res.setHeader('Content-Type', mime[ext] || 'text/plain');
      res.end(data);
      // Log outgoing response
      console.log(`OUTGOING: 200 ${req.url} (${filePath})`);
    } else {
      res.writeHead(404);
      res.end('Not found');
      // Log outgoing response
      console.log(`OUTGOING: 404 ${req.url} (${filePath})`);
    }
  });
}).listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
