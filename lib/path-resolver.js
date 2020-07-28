
class PathResolver {

    // This is to be set by external studio context
    static language;
    static adapters = new Map();

    constructor({ pluginName, componentName, path }) {
        this.path = path;
        this.dataPaths = [];
    }

    resolve({ path }) {
        
    }

    getMockInput() {
        
    }

    finalize() {
        const { language } = ModelGenerator;
        const serverModel = require(`./model-adapters/${language}`)
            .generate({ dataPaths: this.dataPaths });

        // Emit serverModel

        const clientModel = require(`./model-adapters/client`)
            .generate({ dataPaths });


        // Emit clientModel


    }
}

module.exports = PathResolver;