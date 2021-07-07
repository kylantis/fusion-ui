

const { processFile } = require('../../lib/template-processor');
const Preprocessor = require('../../lib/template-preprocessor');
const { parentPort } = require('worker_threads');

parentPort.once('message', ({ dir, fromGulp }) => {    
    
    processFile({
        dir,
        fromGulp,
        Preprocessor,
    }).then(({ assetId, metadata }) => {
        parentPort.postMessage({
            assetId, metadata
        });
    })
});

