const convert = require('xml-js');

class ClientHtmlGenerator {

    static createAttributes(data) {
        return {
            "_attributes": data
        }
    }

    static createHead() {
        const { getMetaAttributes, createAttributes } = ClientHtmlGenerator;
        return {
            meta: getMetaAttributes().map(attr => createAttributes(attr))
        }
    }

    static getMetaAttributes() {
        return [
            { charset: 'UTF-8' },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1.0'
            },
            {
                'http-equiv': 'X-UA-Compatible',
                content: 'ie=edge'
            }
        ];
    }

    static getScriptURLs({ assetId }) {
        return [
            'https://cdn.jsdelivr.net/npm/handlebars@4/runtime.min.js',
            '/assets/js/polyfills/index.min.js',
            '/assets/js/proxy.min.js',
            '/assets/js/base-renderer.min.js',
            '/assets/js/root-ctx-renderer.min.js',
            '/assets/js/custom-ctx-renderer.min.js',
            '/assets/js/web-renderer.min.js',
            '/assets/js/base-component.min.js',
            `/components-assets/${assetId}/index.dist.js`
        ];
    }

    static get({ className, assetId, resolver }) {
        const { createHead, createAttributes, getScriptURLs } = ClientHtmlGenerator;
        const json = {
            html: {
                "_attributes": {
                    lang: 'en'
                },
                head: createHead(),
                body: {
                    script: [
                        ...
                        getScriptURLs({ assetId })
                            .map(url => {
                                return {
                                    ...createAttributes({ src: url }),
                                    _text: '',
                                }
                            }),
                        {
                            _text: `
                            const getRandomInt = function (min = Math.ceil(1000), max = Math.floor(2000000)) {
                                return Math.floor(Math.random() * (max - min + 1)) + min;
                            }

                            (async function() {
                                const data = JSON.parse(${JSON.stringify(
                                    resolver.getMockInput()
                            )});
                                window.__component = new ${className}({
                                    id: \`${assetId}-\${getRandomInt()}\`,
                                    input: data,
                                    parent: document.body,
                                })
                                window.__component.load();
                            })()`
                        }
                    ]
                }
            }
        }

        const options = { compact: true, ignoreComment: true, spaces: 4, sanitize: false };
        return convert.json2xml(json, options);
    }
}

module.exports = ClientHtmlGenerator;