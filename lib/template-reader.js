const parser = require('@handlebars/parser');
const fs = require('fs');
const utils = require('./utils');

class TemplateReader {
    static templates = {};

    static reset() {
      TemplateReader.templates = {};
    }

    static readContents({ path }) {
      try {
        return fs.readFileSync(path, 'utf8');
      } catch (e) {
        throw new Error(`Could not locate template: ${path}`);
      }
    }

    static read({ path }) {
      let ast = TemplateReader.templates[path];

      if (!ast) {
        const partialContents = TemplateReader.readContents({ path });

        ast = parser.parse(partialContents);
        TemplateReader.templates[path] = ast;
      }

      return utils.deepClone(ast);
    }
}
module.exports = TemplateReader;
