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

  fs.readFile(filePath, (err, data) => {
    if (!err) {
      const ext = path.extname(filePath);
      res.setHeader('Content-Type', mime[ext] || 'text/plain');
      res.end(data);
    } else if (!path.extname(reqPath)) {
      filePath = path.join(rootDir, reqPath + '.html');
      fs.readFile(filePath, (err2, data2) => {
        if (!err2) {
          res.setHeader('Content-Type', 'text/html');
          res.end(data2);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}).listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
