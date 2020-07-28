const handlebars = require('handlebars');
const fs = require('fs');

class TemplateReader {
    static templates = {};

    static reset() {
        TemplateReader.templates = {};
    }

    static readContents({ path }) {
        try {
            return fs.readFileSync(path, 'utf8');
        } catch (e) {
            throw new Exception(`Could not locate template: ${path}`);
        }
    }

    static read({ path }) {

        let ast = TemplateReader.templates[path];

        if (!ast) {
            let partialContents = TemplateReader.readContents({ path });

            ast = handlebars.parseWithoutProcessing(partialContents);
            TemplateReader.templates[path] = ast;
        }

        return ast.clone();
    }
}
module.exports = TemplateReader;