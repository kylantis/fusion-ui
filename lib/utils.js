const assert = require('assert');
const pathLib = require('path');
const fs = require('fs');

/* eslint-disable */
module.exports.flattenJson = function (data) {
  const result = {};
  function recurse(cur, prop) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      for (var i = 0, l = cur.length; i < l; i++) recurse(cur[i], prop ? `${prop}.${i}` : `${i}`);
      if (l == 0) result[prop] = [];
    } else {
      let isEmpty = true;
      for (const p in cur) {
        isEmpty = false;
        recurse(cur[p], prop ? `${prop}.${p}` : p);
      }
      if (isEmpty) result[prop] = {};
    }
  }
  recurse(data, '');
  return result;
};

module.exports.getRandomInt = function (min = 10000, max = 99999) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports.generateRandomString = function (length = 8) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

module.exports.ensureUniqueKeys = function (objects, mutualKey) {
  const keys = [];
  for (const json of objects) {
    const k = json[mutualKey];
    if (keys.includes(k)) {
      return false;
    }
    keys.push(k);
  }
  return true;
};

module.exports.extend = function () {
  // Variables
  const extended = {};
  let deep = false;
  let i = 0;
  const { length } = arguments;

  // Check if a deep merge
  if (Object.prototype.toString.call(arguments[0]) === '[object Boolean]') {
    deep = arguments[0];
    i++;
  }

  // Merge the object into the extended object
  const merge = function (obj) {
    for (const prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        // If deep merge and property is an object, merge properties
        if (deep && Object.prototype.toString.call(obj[prop]) === '[object Object]') {
          extended[prop] = extend(true, extended[prop], obj[prop]);
        } else {
          extended[prop] = obj[prop];
        }
      }
    }
  };

  // Loop through each object and conduct a merge
  for (; i < length; i++) {
    const obj = arguments[i];
    merge(obj);
  }

  return extended;
};

module.exports.escapeRegex = string => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

module.exports.getAlias = (name) => {
  name = require('lodash').camelCase(name);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

module.exports.peek = (arr) => {
  if (arr.length > 0) {
    return arr[arr.length - 1];
  }
  return undefined;
}

/**
 * This key is used by deepClone to maintain object
   references inside the object
 */
module.exports.objectReferenceKey = '__objReferenceId';


module.exports.parseJson = (jsonString) => {
  const objectReferences = {};

  const restoreObjectReferences = (key, val) => {
    if (val && val.constructor.name === 'Object') {
      const refKey = val[this.objectReferenceKey];
      if (refKey) {
        return objectReferences[refKey] || (objectReferences[refKey] = val);
      }
    }
    return val;
  }

  return JSON.parse(jsonString, restoreObjectReferences)
}

module.exports.deepClone = (o) => JSON.parse(JSON.stringify(o));

module.exports.equals = (o1, o2) => {
  return JSON.stringify(o1) === JSON.stringify(o2);
}
module.exports.clear = (o) => {
  for (const key of Object.keys(o)) {
    delete o[key];
  }
}

module.exports.update = (str, substring, replacement, fromBehind = false) => {
  assert(!!substring.length);
  const index = fromBehind ? str.lastIndexOf(substring) : str.indexOf(substring);
  return str.substring(0, index) + replacement + str.substring(index + substring.length, str.length);;
}

// Todo: remove (not used)
module.exports.arrayEquals = (arr1, arr2) => {
  if (arr1.length != arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[2]) {
      return false;
    }
  }
  return true;
}

// Todo: remove (not used)
module.exports.getPermutations = (string) => {
  if (!string || typeof string !== "string") {
    return "Please enter a string"
  }

  if (!!string.length && string.length < 2) {
    return string
  }

  let permutationsArray = []

  for (let i = 0; i < string.length; i++) {
    let char = string[i]

    if (string.indexOf(char) != i)
      continue

    let remainder = string.slice(0, i) + string.slice(i + 1, string.length)

    for (let permutation of findPermutations(remainder)) {
      permutationsArray.push(char + permutation)
    }
  }
  return permutationsArray
}

module.exports.getAllComponentNames = () => {
  const componentsFolder = pathLib.join(process.env.PWD, 'src', 'components');

  return fs.readdirSync(componentsFolder)
    .filter(name => fs.lstatSync(pathLib.join(componentsFolder, name)).isDirectory());
}
