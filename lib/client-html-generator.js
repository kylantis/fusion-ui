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

  static getLoader() {
    return {
      div: {
        _attributes: {
          id: 'page-loader',
          style: 'position: absolute; display: table; width: 100%; height: 100%; z-index: 1000'
        },
        _text: `
        <div style='vertical-align: middle; display: table-cell;'>
          <img width='20px' src='/assets/images/loader.gif' style='display: block; margin-left: auto; margin-right: auto;'>
        </div>`
      }
    }
  }


  static getScriptURLs() {
    return [
      // 'https://cdn.jsdelivr.net/npm/handlebars@4.7.6/dist/handlebars.runtime.min.js',
      '/assets/js/cdn/handlebars.runtime.min.js',
      // Using 8.1.0 instead of the latest due to this bug:
      // https://issueexplorer.com/issue/ajv-validator/ajv/1744
      // 'https://cdnjs.cloudflare.com/ajax/libs/ajv/8.1.0/ajv7.min.js',
      '/assets/js/cdn/ajv.min.js',
      '/assets/js/polyfills/index.min.js',
      '/assets/js/app-context.min.js',
    ];
  }

  static get({ className }) {
    const { createHead, createAttributes, getScriptURLs, getLoader, } = ClientHtmlGenerator;
    const json = {
      html: {
        _attributes: {
          lang: 'en',
        },
        head: createHead(),
        body: {
          ...getLoader(),
          script: [
            ...getScriptURLs()
              .map(url => ({
                ...createAttributes({ src: url }),
                _text: '',
              })),
            {
              _text: `
                                window.module = {
                                  exports: {},
                                };

                                module.exports = {};

                                new AppContext({
                                  logger: console,
                                  userGlobals: {
                                    rtl: "{{rtl}}",
                                  }
                                })
                                .start({
                                  rootComponent: '${className}',
                                  testMode: "{{testMode}}",
                                  data: "{{data}}"
                                })
                                .then(() => {
                                  const loader = document.getElementById('${getLoader().div._attributes.id}');
                                  loader.parentElement.removeChild(loader);
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
    return convert.json2xml(json, options)
      .replaceAll('&gt;', '>')
      .replaceAll('&lt;', '<')
  }
}

module.exports = ClientHtmlGenerator;
