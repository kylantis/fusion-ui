const fs = require('fs');
const path = require('path');
const restify = require('restify');
const { NotFoundError, InternalServerError } = require('restify-errors');
const mime = require('mime-types');

const server = restify.createServer({
  name: 'Kylantis',
  versions: ['0.1'],
});


server.get('/*', (req, res, next) => {

  const filePath = path.join(__dirname, '../dist', req.params['*']);

  fs.stat(filePath, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return next(new NotFoundError('File not found'));
      } else {
        return next(new InternalServerError(err));
      }
    }

    const etag = generateETag(stats);

    if (req.headers['if-none-match'] === etag) {

      res.status(304);
      return res.end();
    }

    const contentType = mime.contentType(path.extname(filePath)) || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('ETag', etag);

    const stream = fs.createReadStream(filePath);
    
    stream.on('error', (err) => {
      return next(new InternalServerError(err));
    });

    stream.pipe(res);
  });
});


server.listen(8090, () => { });

// Function to generate ETag for a file
function generateETag(stats) {
  return '"' + stats.size.toString(16) + '-' + stats.ctime.getTime().toString(16) + '"';
}