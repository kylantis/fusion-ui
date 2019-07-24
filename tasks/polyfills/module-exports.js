// This is a polyfill that allows client-side code to do
// module.exports = ... in the browser

// eslint-disable-next-line no-undef
window.module = {
  exports: {},
};
