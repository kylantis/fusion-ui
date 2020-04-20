const handlebars = require('handlebars');
const fs = require('fs');

class TemplateReader {
  static templates = {};

    static reset() {
        TemplateReader.templates = {};
    }

    static read(templatePath, fallbackContent) {
        
        let ast = TemplateReader.templates[templatePath];

        if (!ast) {
            let partialContents;
            try {
                partialContents = fs.readFileSync(templatePath, 'utf8');
            } catch (e) {
                // The template was not found, try to find a fallback
                if (fallbackContent) {
                    return { type: 'ContentStatement', original: `${fallbackContent}`, value: `${fallbackContent}` }
                } else {
                    throw new Exception(`Could not locate template: ${templatePath}`);
                }
            }

            ast = handlebars.parseWithoutProcessing(partialContents);
            TemplateReader.templates[templatePath] = ast;
        }

        // return {
        //     type: 'Program',
        //     body: ast.body.slice(0, ast.body.length)
        // };

        return JSON.parse(JSON.stringify(ast));
    }
}
module.exports=TemplateReader;