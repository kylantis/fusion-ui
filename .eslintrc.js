module.exports = {
  extends: "airbnb-base",
  env: {
    es6: true,
  },
  parser: "babel-eslint",
  plugins: [
    "classPrivateMethods",
    "babel"
  ],
  rules: {
    'strict': 1,
  },
  globals: {}
}