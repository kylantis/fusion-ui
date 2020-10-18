const restify = require('restify');

const server = restify.createServer({
  name: 'Kylantis',
  versions: ['0.1'],
});

// server.use((req, res, next) => {
//   res.setHeader(
//     'Content-Security-Policy',
//     "script-src 'self' https://apis.google.com",
//   );
//   return next();
// });

server.get('/*', restify.plugins.serveStatic({
  directory: './dist',
  default: 'index.html',
}));

server.listen(8080, () => {
  // eslint-disable-next-line no-console
  console.info('%s listening at %s', server.name, server.url);
});
