module.exports = {
  extends: "airbnb-base",
  env: {
    es6: true,
    browser: true,
    jquery: true
  },
  parser: "babel-eslint",
  rules: {
    'strict': 0,
    "no-restricted-syntax": ["error" /*"ForInStatement"*//*", ForOfStatement"*/, "LabeledStatement", "WithStatement"], // Todo: Except when necessary, remove this and refractor affected files
    'no-plusplus': ['error', { "allowForLoopAfterthoughts": true }], // Todo: Except when necessary, remove this and refractor affected files,
    'linebreak-style': 0, // Team members use various operating systems, hence multiple line break styles
    'indent': ['error', 4],
    'no-console': 'off',
    'class-methods-use-this': 0
    // Todo: src/assets/js/*.js and src/app-shell/index.js have been excluded from lint. Refractor and include these file(s)
  },
  "globals": {
    "BaseComponent": "readonly",
    "globals": "readonly"
  }
}