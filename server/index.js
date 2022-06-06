
var http = require('http')
var serveStatic = require('serve-static')

// Serve up dist folder
var serve = serveStatic('dist', { index: ['index.html'] })

// Create server
var server = http.createServer(function onRequest (req, res) {
  serve(req, res, () => {})
})

// Listen
server.listen(8090)