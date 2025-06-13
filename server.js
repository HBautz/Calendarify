const http = require('http');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, 'web', 'dist');
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
  const filePath = path.join(dist, reqPath);
  fs.readFile(filePath, (err, data) => {
    if (!err) {
      const ext = path.extname(filePath);
      res.setHeader('Content-Type', mime[ext] || 'text/plain');
      res.end(data);
    } else {
      fs.readFile(path.join(dist, 'index.html'), (err2, indexData) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.setHeader('Content-Type', 'text/html');
          res.end(indexData);
        }
      });
    }
  });
}).listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
