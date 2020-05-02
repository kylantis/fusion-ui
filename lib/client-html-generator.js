const convert = require('xml-js');

class ClientHtmlGenerator {

    static get({ className, componentName }) {
        const json = {
            html: {
                "_attributes": {
                    lang: 'en' // Todo: use the appropriate lang here
                },
                head: {
                    meta: [
                        {
                            "_attributes": {
                                charset: 'UTF-8'
                            }
                        },
                        {
                            "_attributes": {
                                name: 'viewport',
                                content: 'width=device-width, initial-scale=1.0'
                            }
                        },
                        {
                            "_attributes": {
                                'http-equiv': 'X-UA-Compatible',
                                content: 'ie=edge'
                            }
                        }
                    ]
                },
                body: {
                    script: [
                        {
                            "_attributes": {
                                src: '/assets/js/polyfills/index.min.js'
                            },
                            _text: '',
                        },
                        {
                            "_attributes": {
                                src: '/components/base.min.js'
                            },
                            _text: '',
                        },
                        {
                            "_attributes": {
                                src: `/components/${componentName}/index.dist.js`,
                            },
                            _text: '',
                        },
                        {
                            _text: `
                            getRandomInt(min = Math.ceil(1000), max = Math.floor(2000000)) {
                                return Math.floor(Math.random() * (max - min + 1)) + min;
                            }
                            BaseComponent.loadedStyles = [];
                            BaseComponent.loadedScripts = [];
                            (async function() {
                                const data = await BaseComponent.load('/components/${componentName}/sample.json');
                                window.__component = new ${className}({
                                    id: \`${componentName}-\${getRandomInt()}\`,
                                    input: JSON.parse(data),
                                    parent: document.body,
                                })
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