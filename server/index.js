const restify = require('restify');

const server = restify.createServer({
  name: 'Kylantis',
  versions: ['0.1'],
});


server.get('/*', restify.plugins.serveStatic({
  directory: './dist',
  default: 'index.html',
}));

server.listen(8090, () => {});



// var http = require('http')
// var serveStatic = require('serve-static')

// // Serve up dist folder
// var serve = serveStatic('dist', { index: ['index.html'] })

// // Create server
// var server = http.createServer(function onRequest (req, res) {
//   serve(req, res, () => {})
// })

// // Listen
// server.listen(8090)