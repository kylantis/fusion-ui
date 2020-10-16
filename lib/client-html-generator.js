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

  static getGlobalScriptURLs() {
    return [
      'https://cdn.jsdelivr.net/npm/handlebars@4.7.6/dist/handlebars.min.js',
      '/assets/js/polyfills/index.min.js',
      '/assets/js/add-polyfills.min.js',
      '/assets/js/proxy.min.js',
      '/assets/js/base-renderer.min.js',
      '/assets/js/root-ctx-renderer.min.js',
      '/assets/js/custom-ctx-renderer.min.js',
      '/assets/js/web-renderer.min.js',
      '/assets/js/base-component.min.js',
      '/assets/js/root-context.min.js',
      '/assets/js/worker-context.min.js',
    ];
  }

  static getScriptURLs({ assetId }) {
    const { getGlobalScriptURLs } = ClientHtmlGenerator;
    return [
      ...getGlobalScriptURLs(),
      `/components/${assetId}/index.dist.js`,
    ];
  }

  // Todo: Add support for "components."
  static get({ className, assetId, resolver }) {
    const { createHead, createAttributes, getScriptURLs } = ClientHtmlGenerator;
    const json = {
      html: {
        _attributes: {
          lang: 'en',
        },
        head: createHead(),
        body: {
          script: [
            ...getScriptURLs({ assetId })
              .map(url => ({
                ...createAttributes({ src: url }),
                _text: '',
              })),
            {
              _text: `
                                module = { exports: {} };

                                const data = ${JSON.stringify(resolver.getSample(), null, 2)};
                                window.__component = new ${className}({
                                    input: data,
                                })
                                window.__component.load({ parent: document.body });
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
