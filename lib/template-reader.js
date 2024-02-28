const fs = require('fs');

class TemplateReader {

    static readContents({ path }) {
      try {
        return fs.readFileSync(path, 'utf8');
      } catch (e) {
        throw Error(`Could not locate template: ${path}`);
      }
    }

    static read({ path, astProducer }) {
        const partialContents = TemplateReader.readContents({ path });

        return {
          partialContents,
          program: astProducer(partialContents),
        };
    }
}
module.exports = TemplateReader;
