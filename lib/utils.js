/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const assert = require('assert');
const pathLib = require('path');
const fs = require('fs');
const brotli = require('brotli-wasm');
const zlib = require('node:zlib');

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports.escapeRegExp = escapeRegExp;

module.exports.splitWithDelimiters = (inputString, delimiters) => {
  // Create a regular expression with delimiters as alternations
  const delimiterRegex = RegExp(`(${delimiters.map(delim => escapeRegExp(delim)).join('|')})`);

  // Split the input string using the regular expression
  const resultArray = inputString.split(delimiterRegex);

  // Remove empty strings from the result array
  return resultArray.filter(str => str !== '');
}

module.exports.containsAnySubstring = (inputString, substrings) => {
  // Loop through the substrings array
  for (const substring of substrings) {
    // Check if the inputString contains the current substring
    if (inputString.includes(substring)) {
      return true; // Return true if a match is found
    }
  }

  return false; // Return false if no match is found
}

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
 * This key is used by <parseJson> to maintain object
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
      if (val.__isFunction) {
        return new Function('return ' + val.body)()
      }
    }
    return val;
  }

  return JSON.parse(jsonString, restoreObjectReferences)
}

module.exports.stringifyJson = (jsonObject) => {
  return JSON.stringify(jsonObject, (key, val) => {
    if (typeof val === 'function') {
      return { __isFunction: true, body: val.toString() }
    }
    return val;
  });
};

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

module.exports.replaceSubstring = (str, startIndex, endIndex, newSubstring) => {
  const before = str.substring(0, startIndex);
  const after = str.substring(endIndex);
  return before + newSubstring + after;
}

module.exports.arrayEquals = (arr1, arr2) => {
  if (!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length != arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}

module.exports.areArrayElementsSameReference = (arr) => {
  if (arr.length === 0) {
    return true; // An empty array trivially satisfies the condition.
  }

  const firstElement = arr[0];

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== firstElement) {
      return false; // If any element is not the same reference, return false.
    }
  }

  return true; // All elements are the same reference.
}

module.exports.findFirstNonBlankIndex = (inputString) => {
  for (let i = 0; i < inputString.length; i++) {
    if (!/\s/.test(inputString[i])) {
      return i;
    }
  }
  return -1; // Return -1 if the string is empty or contains only blanks
}

module.exports.lastIndexOf = (inputString, regex) => {
  let match;
  let lastIndex = -1;

  // Iterate through matches using exec
  while ((match = regex.exec(inputString)) !== null) {
    lastIndex = match.index;
  }

  return lastIndex;
}

module.exports.isNumber = (n) => {
  return !Number.isNaN(parseInt(n, 10))
}

module.exports.findWordMatches = (str, word, start = 0, max) => {
  const regex = new RegExp(escapeRegExp(word), 'g');

  regex.lastIndex = start;

  let match;
  const arr = [];

  while ((match = regex.exec(str)) !== null) {
    arr.push(match.index);

    if (max && (arr.length == max)) break;
  }

  return arr.length ? arr : null; // Return null if no matches found
}

module.exports.parseJSONFromStringAtIndex = (str, index) => {
  assert(str.charAt(index) == '{');

  let depth = 0; // Keep track of nested levels
  let token = ''; // Current token being built
  let inString = false; // Flag to track if currently inside a string
  let inEscape = false; // Flag to track if the character is escaped
  let currentChar;

  // Iterate through the string starting from the given index
  for (let i = index; i < str.length; i++) {
    currentChar = str.charAt(i);

    // If currently inside a string
    if (inString) {
      // Handle escape characters
      if (inEscape) {
        token += currentChar;
        inEscape = false;
      } else if (currentChar === '\\') {
        inEscape = true;
        token += currentChar;
      } else if (currentChar === '"') {
        // End of string
        token += currentChar;
        inString = false;
      } else {
        token += currentChar;
      }
    } else {
      // Not inside a string
      if (currentChar === '"') {
        // Start of a string
        token += currentChar;
        inString = true;
      } else if (currentChar === '{' || currentChar === '[') {
        // Start of nested object or array
        token += currentChar;
        depth++;
      } else if (currentChar === '}' || currentChar === ']') {
        // End of nested object or array
        token += currentChar;
        depth--;

        // If depth is back to 0, the JSON object is complete
        if (depth === 0) {
          break;
        }
      } else if (currentChar === ',' && depth === 0) {
        // End of top-level value
        break;
      } else if (/\S/.test(currentChar)) {
        // Add non-whitespace characters to token
        token += currentChar;
      }
    }
  }

  // Parse the token as JSON
  return JSON.parse(token);
}

module.exports.getAllComponentNames = () => {
  const componentsFolder = pathLib.join(process.env.PWD, 'src', 'components');

  return fs.readdirSync(componentsFolder)
    .filter(name => fs.lstatSync(pathLib.join(componentsFolder, name)).isDirectory());
}

module.exports.getCompressionAlgorithms = () => {
  return ['br', 'deflate'];
}

module.exports.getCompressedFiles = (path, contents, algos = this.getCompressionAlgorithms()) => {
  return algos
    .map(algo => [
      `${path}.${algo}`,
      (() => {
        switch (algo) {
          case 'br':
            return brotli.compress(contents);
          case 'deflate':
            return zlib.deflateSync(contents);
          default:
            throw Error(`Compression algorithm "${algo}" not supported`);
        }
      })()
    ])
}