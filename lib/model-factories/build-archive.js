const languages = require('./languages');
const jarBuilder = require('./java/jar-builder');

// eslint-disable-next-line default-case
switch (process.env.targetLanguage || 'java') {
  case languages.Java:
    // eslint-disable-next-line global-require
    jarBuilder();
    break;
}

console.info(`\x1b[32m[Archive generated successfully]\x1b[0m`);