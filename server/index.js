const fs = require('fs');
const pathLib = require('path');
const restify = require('restify');
const { NotFoundError, InternalServerError } = require('restify-errors');
const mime = require('mime-types');

const server = restify.createServer({
  name: 'Kylantis',
  version: '1.0.0'
});

const getFileStream = (req, res) => {
  const path = req.params['*'];
  const filePath = pathLib.join(__dirname, '../dist', path);
  const acceptEncoding = req.headers['accept-encoding'] || '';

  const contentType = mime.contentType(pathLib.extname(filePath)) || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  if (acceptEncoding.includes('br')) {
    const brFilePath = `${filePath}.br`;

    if (fs.existsSync(brFilePath)) {

      res.setHeader('Content-Encoding', 'br');
      return fs.createReadStream(brFilePath);
    }

    // .br file not found
    console.info(`${brFilePath} not found`);
  }

  return fs.existsSync(filePath) ?
    fs.createReadStream(filePath) : null;
}

const serveStaticFile = (req, res, next) => {
  res.setHeader('Cache-Control', `public, max-age=${604800}`); // 1 Week

  const stream = getFileStream(req, res);

  if (!stream) {
    return next(new NotFoundError('File not found'));
  }

  stream.on('error', (err) => {
    return next(new InternalServerError(err));
  });

  stream.pipe(res);
};

server.get('/*', serveStaticFile);

server.listen(8090, () => { });
