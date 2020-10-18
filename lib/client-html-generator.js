const convert = require('xml-js');

class ClientHtmlGenerator {
  static createAttributes(data) {
    return {
      _attributes: data,
    };
  }

  static createHead() {
    const { getMetaAttributes, createAttributes } = ClientHtmlGenerator;
    return {
      meta: getMetaAttributes().map(attr => createAttributes(attr)),
    };
  }

  static getMetaAttributes() {
    return [
      { charset: 'UTF-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0',
      },
      {
        'http-equiv': 'X-UA-Compatible',
        content: 'ie=edge',
      },
    ];
  }


  static getScriptURLs() {
    return [
      '/assets/js/app-context.min.js',
    ];
  }

  // Todo: Add support for "components."
  static get({ className, resolver }) {
    const { createHead, createAttributes, getScriptURLs } = ClientHtmlGenerator;
    const json = {
      html: {
        _attributes: {
          lang: 'en',
        },
        head: createHead(),
        body: {
          div: {
            _attributes: {
              id: 'parent',
            },
            _text: '',
          },
          script: [
            {
              _text: `
                module = {exports: {}};
              `,
            },
            ...getScriptURLs()
              .map(url => ({
                ...createAttributes({ src: url }),
                _text: '',
              })),
            {
              _text: `
                                new AppContext({
                                  logger: console,
                                  serverUrl: new URL('http://localhost:8080'),
                                })
                                .start({
                                  data: ${JSON.stringify(resolver.getSample(), null, 2)},
                                  rootComponent: '${className}'
                                });
                           `,
            },
          ],
        },
      },
    };

    const options = {
      compact: true, ignoreComment: true, spaces: 4, sanitize: false,
    };
    return convert.json2xml(json, options);
  }
}

module.exports = ClientHtmlGenerator;
