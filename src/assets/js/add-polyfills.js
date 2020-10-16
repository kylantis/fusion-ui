/* eslint-disable no-restricted-syntax */
/* eslint-disable func-names */
/* eslint-disable no-extend-native */

Array.prototype.peek = function () {
  if (this.length > 0) {
    return this[this.length - 1];
  }
  return undefined;
};
Array.prototype.clone = function () {
  return JSON.parse(JSON.stringify(this));
};
Array.prototype.equals = function (array) {
  return JSON.stringify(this) === JSON.stringify(array);
};

Object.prototype.clone = function () {
  return JSON.parse(JSON.stringify(this));
};

Object.prototype.clear = function () {
  for (const key of Object.keys(this)) {
    delete this[key];
  }
};

String.prototype.replaceAt = function (index, replacement) {
  return this.substr(0, index) + replacement + this.substr(index, this.length);
};

String.prototype.update = function (substring, replacement) {
  let str = this;
  const index = str.indexOf(substring);

  str = str.replace(substring, ' ');

  str = str.replaceAt(
    index,
    replacement,
  );

  return str;
};
