const restify = require('restify');

const server = restify.createServer({
    name: 'Imagine UI Server',
    versions: ['1.0.0'],
});
 
server.get('/client-stubs/default/*', restify.plugins.serveStatic({
    directory: './dist',
    default: 'index.html',
}));

server.get('/*', restify.plugins.serveStatic({
    directory: './dist',
    default: 'index.html',
}));

server.listen(8080, () => {
    console.log('%s listening at %s', server.name, server.url);
});
