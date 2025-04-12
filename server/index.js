const fs = require('fs');
const pathLib = require('path');
const restify = require('restify');
const { NotFoundError, InternalServerError, PreconditionFailedError } = require('restify-errors');
const mime = require('mime-types');
const AppContext = require('../src/assets/js/app-context');

const server = restify.createServer({
  name: 'Kylantis',
  version: '1.0.0'
});

const getFilePath = (reqPath) => pathLib.join(__dirname, '../dist', reqPath);

const serveStaticFile = (req, res, next) => {
  res.setHeader('Cache-Control', `public, max-age=${604800}`); // 1 Week

  const getFileStream = (req, res) => {

    const reqPath = req.params['*'];
    const filePath = getFilePath(reqPath);
    const acceptEncoding = req.headers['accept-encoding'] || '';

    const contentType = mime.contentType(pathLib.extname(filePath)) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    switch (true) {
      case acceptEncoding.includes('br'):
        const brFilePath = `${filePath}.br`;
        if (fs.existsSync(brFilePath)) {
          res.setHeader('Content-Encoding', 'br');
          return fs.createReadStream(brFilePath);
        }
        // .br file not found
        break;
      case acceptEncoding.includes('deflate'):
        const deflateFilePath = `${filePath}.deflate`;
        if (fs.existsSync(deflateFilePath)) {
          res.setHeader('Content-Encoding', 'deflate');
          return fs.createReadStream(deflateFilePath);
        }
        // .deflate file not found
        break;
    }

    return fs.existsSync(filePath) ?
      fs.createReadStream(filePath) : null;
  }

  const stream = getFileStream(req, res);

  if (!stream) {
    return next(new NotFoundError('File not found'));
  }

  stream.on('error', (err) => {
    return next(new InternalServerError(err));
  });

  stream.pipe(res);
};

const requestNetworkCacheFile = async (req, res) => {
  res.setHeader('Cache-Control', `public, max-age=${604800}`); // 1 Week

  const params = new URLSearchParams(req.query());
  const { assetId, numFiles } = Object.fromEntries(params.entries());

  const getFileBuffer = (path, compressed) => new Promise(resolve => {
    fs.readFile(getFilePath(`${path}${compressed ? `.deflate` : ''}`), (err, data) => {
      if (err) throw err;
      resolve(data);
    })
  })

  const [bootConfig, componentList] = await Promise.all([
    getFileBuffer(`/components/${assetId}/boot-config.json`).then(buf => JSON.parse((buf.toString('utf8')))),
    getFileBuffer(`/components/list.json`).then(buf => JSON.parse((buf.toString('utf8'))))
  ]);

  const fileList = AppContext.getAllDependencies(
    assetId, bootConfig, componentList, true
  );

  if (fileList.length != numFiles) {
    return res.send(
      new PreconditionFailedError(
        `numFiles mismatch; client=${numFiles}, server=${fileList.length};`
      )
    )
  }

  const fileBuffers = await Promise.all(fileList.map(f => getFileBuffer(f, true)));

  let buffer = Buffer.alloc(0);
  const fileIndices = [];

  fileBuffers.forEach(_buf => {
    buffer = Buffer.concat([buffer, _buf]);
    fileIndices.push(buffer.length);
  });

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('File-Indices', fileIndices.join(','));

  res.end(buffer);
}

server.get(`/web/components/request-network-cache-file`, requestNetworkCacheFile);
server.get('/*', serveStaticFile);

server.listen(8090, () => { });
