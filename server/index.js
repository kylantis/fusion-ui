const fs = require('fs');
const path = require('path');
const restify = require('restify');
const { NotFoundError, InternalServerError } = require('restify-errors');
const mime = require('mime-types');

const server = restify.createServer({
  name: 'Kylantis',
  version: '1.0.0'
});

const serveStaticFile = (req, res, next) => {
  const filePath = path.join(__dirname, '../dist', req.params['*']);

  fs.access(filePath, fs.constants.F_OK, err => {
    if (err) {
      return next(new NotFoundError('File not found'));
    }

    const contentType = mime.contentType(path.extname(filePath)) || 'application/octet-stream';
  
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', `public, max-age=${604800}`); // 1 Week
   
    const stream = fs.createReadStream(filePath);

    stream.on('error', (err) => {
      return next(new InternalServerError(err));
    });
  
    stream.pipe(res);
  });
};

server.get('/*', serveStaticFile);

server.listen(8090, () => { });
