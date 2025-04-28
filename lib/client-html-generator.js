const xmljs = require('xml-js');

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
      title: {
        _text: `{{pageTitle}}`,
      },
      link: {
        _attributes: {
          rel: 'icon',
          href: `{{pageIconURL}}`,
        }
      }
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

  static json2xml(json) {
    const options = {
      compact: true, ignoreComment: true, spaces: 4, sanitize: false,
    };

    return xmljs.json2xml(json, options)
      .replaceAll('&gt;', '>')
      .replaceAll('&lt;', '<')
  }

  static get({ className, assetId, bootConfig }) {
    const { createHead, createAttributes, getScriptURLs, json2xml } = ClientHtmlGenerator;

    const json = {
      html: {
        _attributes: {
          lang: 'en',
        },
        head: createHead(),
        body: {
          script: [
            {
              _text: `
              self.module = {
                exports: {},
              };
              `,
            },
            ...getScriptURLs()
              .map(url => ({
                ...createAttributes({ src: url }),
                _text: '',
              })),
            {
              _text: `
                const componentList = \`<componentList></componentList>\`;

                                new AppContext({
                                  logger: console,
                                  userGlobals: "{{userGlobals}}",
                                  className: '${className}',
                                  assetId: '${assetId}',
                                  bootConfig: ${JSON.stringify(bootConfig)},
                                  componentList,
                                  testMode: "{{testMode}}",
                                  sessionId: "{{sessionId}}"
                                })
                                  .load({
                                    data: "{{data}}",
                                    runtimeBootConfig: "{{runtimeBootConfig}}"
                                  });
                           `,
            },
          ],
          style: {
            _text: `
              body,
              html {
                  background: #fff !important;
              }
              .mst-w {
                  display: contents;
              }
            `
          }
        },
      },
    };

    return `
    ${json2xml(json)}
    `;
  }
}

module.exports = ClientHtmlGenerator;
