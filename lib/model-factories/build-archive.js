const languages = require('../languages');
const jarBuilder = require('./java/jar-builder');

// eslint-disable-next-line default-case
switch (process.env.targetLanguage || 'java') {
  case languages.Java:
    // eslint-disable-next-line global-require
    jarBuilder();
    break;
}
