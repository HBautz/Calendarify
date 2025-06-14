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
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
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
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}).listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
