
/* eslint-disable no-underscore-dangle */

const arrayIndexSegment = /\[[0-9]+\]/g;

// Note: The reason why we are using .+ instead of \w+ is because map keys are actually
// free-form string that can contain anything
const mapKeySegment = /\["\$_.+?"\]/g;

const canonicalArrayIndex = /_\$$/g
const segment = /(\[[0-9]+\])|(\["\$_.+?"\])/g;
const segmentWithCanonical = /(\[[0-9]+\])|(\["\$_.+?"\])|(_\$)/g;

module.exports = {
  arrayIndexSegment,
  mapKeySegment,
  getParentFromPath(pathArray) {

    if (typeof pathArray == 'string') {
      pathArray = pathArray.split('.');
    }

    const arr = [...pathArray];
    const lastPart = arr[arr.length - 1];

    const segments = clientUtils.getSegments({ original: lastPart });

    if (segments.length > 1) {
      segments.pop();
      arr[arr.length - 1] = segments.join('');
    } else {
      arr.pop();
    }
    return arr.join('.');
  },

  getKeyFromIndexSegment(segment) {
    assert(segment.startsWith('['));
    return segment.replace(/\["?/g, '').replace(/"?\]/g, '')
  },

  tailSegment: (part) => {
    return part.match(segment).pop();
  },

  getCommaSeperatedValues: (str, minLength, defaultValue) => {
    const arr = str.trim().split(/\s*,\s*/g);

    if (Number.isInteger(minLength)) {
      assert(defaultValue !== undefined);

      for (let i = arr.length; i < minLength; i++) {
        arr[i] = defaultValue;
      }
    }

    return arr;
  },

  flattenJson: (data) => {
    const result = {};
    function recurse(cur, prop) {
      if (Object(cur) !== cur) {
        result[prop] = cur;
      } else if (Array.isArray(cur)) {
        // eslint-disable-next-line no-plusplus
        for (let i = 0, l = cur.length; i < l; i++) recurse(cur[i], prop ? `${prop}.${i}` : `${i}`);
        // eslint-disable-next-line no-undef
        if (l === 0) result[prop] = [];
      } else {
        let isEmpty = true;
        // eslint-disable-next-line no-restricted-syntax
        for (const p in cur) {
          if ({}.hasOwnProperty.call(cur, p)) {
            isEmpty = false;
            recurse(cur[p], prop ? `${prop}.${p}` : p);
          }
        }
        if (isEmpty) result[prop] = {};
      }
      if (Object(cur) === cur && prop) {
        // eslint-disable-next-line no-param-reassign
        cur['@path'] = prop;
      }
    }
    recurse(data, '');
    return result;
  },

  escapeRegExp: (text) => {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  },

  randomString: () => {
    const length = 8;
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const charactersLength = characters.length;
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  },

  stringifyComponentData: (srcObject) => {
    const replacer = (name, val) => {
      const mapType = 'Map';
      if (val && val.constructor.name === 'Object') {
        if (val['@type'] == mapType) {
          delete val['@type'];
        }
        if (val['@type']) {
          // This is a component, see toJSON() in BaseRenderer
          const data = JSON.stringify(val['@data'], replacer, 2)

            // Normalize by replacing double quotes to single quotes, so we can inline <data> below
            .replace(/"/g, "@@")
            ;

          return `%%new components['${val['@type']}']({
          input: ${data},
        }, { loadable: ${val['@loadable']} })%%`
            .replace(/\n/g, '');
        }
      }

      return val;
    };
    return JSON.stringify(srcObject, replacer, 2)
      .replace(/@@/g, '"')
      .replaceAll(/"%%/g, '')
      .replaceAll(/%%"/g, '')
      .replace(/\n/g, '');
  },

  deepClone: (o) => {
    return JSON.parse(JSON.stringify(o));
  },

  getSegments: ({ original }) => {
    return clientUtils.getSegments0(original, segment)
  },

  getSegments0: (original, regex) => {
    const segments = original.match(regex) || [];

    const first = original.replace(
      RegExp(
        `${clientUtils.escapeRegExp(segments.join(''))}$`
      ),
      ''
    );

    return [
      first,
      ...segments,
    ];
  },

  getParentPaths: (original) => {
    const arr = original.split('.');
    let r = '';

    const result = [];

    for (let i = 0; i < arr.length; i++) {

      const segments = clientUtils.getSegments({ original: arr[i] });

      segments.forEach(s => {
        r += s;

        if (original != r) {
          result.push(r);
        }
      });

      if (i < arr.length - 1) {
        r += '.';
      }
    }

    assert(r == original);

    return result;
  },

  peek: (arr) => {
    if (arr.length > 0) {
      return arr[arr.length - 1];
    }
    return undefined;
  },

  countSubstrings: (str, searchValue) => {
    let count = 0,
      i = 0;
    while (true) {
      const r = str.indexOf(searchValue, i);
      if (r !== -1) [count, i] = [count + 1, r + 1];
      else return count;
    }
  },

  getIndexes: (start, len) => {
    const keys = [];
    for (let i = start; i < len; i++) {
      keys.push(i);
    }
    return keys;
  },

  getCollectionKeys: (obj) => {
    if (Array.isArray(obj)) {
      return clientUtils.getIndexes(0, obj.length);
    } else {
      return Object.keys(obj);
    }
  },

  getCollectionLength: (coll) => {
    const { mapSizeProperty } = RootProxy;
    return Array.isArray(coll) ? coll.length : coll[mapSizeProperty];
  },

  getCollectionIndex: (coll, key) => {
    return Array.isArray(coll) ? Number(key) : Object.keys(coll).indexOf(key);
  },

  getCollectionIndexAndLength: (coll, key) => {
    const { mapKeyPrefix, isMapProperty } = RootProxy;

    assert(
      (Array.isArray(coll) && clientUtils.isNumber(key)) ||
      (coll[isMapProperty] && key.startsWith(mapKeyPrefix))
    );

    return {
      index: clientUtils.getCollectionIndex(coll, key),
      length: clientUtils.getCollectionLength(coll),
    };
  },

  getCanonicalSegments: (fqPath) => {

    const fqPathArr = fqPath.split('.');

    const arr = [];
    let p = '';

    // eslint-disable-next-line no-labels
    loop:
    for (let i = 0; i < fqPathArr.length; i++) {

      const segments = clientUtils.getSegments0(fqPathArr[i], canonicalArrayIndex);

      // eslint-disable-next-line no-plusplus
      for (let j = 0; j < segments.length; j++) {
        if (j == 0) {
          p += `${i > 0 ? '.' : ''}${segments[j]}`;

          const accept = (segment) => {
            arr.push(segment);
            if (segment.match(canonicalArrayIndex)) {
              accept(segment.replace(canonicalArrayIndex, ''));
            }
          }
          accept(p);

        } else {
          // We encountered an index..., i.e. [0]
          break loop;
        }
      }
    }
    return arr.sort((x, y) => y.length - x.length);
  },

  toCanonicalPath: (fqPath) => {
    if (fqPath.constructor.name == 'Array') {
      if (!fqPath.length) {
        return fqPath;
      }
      return fqPath.map(s => clientUtils.toCanonicalPath0(s));
    } else {
      assert(typeof fqPath == 'string');
      return clientUtils.toCanonicalPath0(fqPath);
    }
  },

  toCanonicalPath0: (fqPath) => {
    const separator = '.';
    return fqPath.split(separator)
      .map(p => clientUtils.getSegments({
        original: p,
      }).map((segment) => {
        switch (true) {
          case !!segment.match(arrayIndexSegment):
            return '_$';
          case !!segment.match(mapKeySegment):
            return `${separator}$_`;
          case segment.startsWith('$_'):
            return '$_';
          default: return segment;
        }
      }).join('')).join(separator);
  },

  isCanonicalArrayIndex: (path, parent) => {
    const arr = parent.split('.');

    const index = arr.length - 1;
    const segmentIndex = clientUtils.getSegments0(arr[index], segmentWithCanonical).length;

    const arr2 = path.split('.');
    const segments = clientUtils.getSegments0(arr2[index], segmentWithCanonical);

    assert(segments.length > segmentIndex);

    return segments[segmentIndex] == '_$';
  },

  isNumber: (n) => {
    return !Number.isNaN(parseInt(n, 10))
  },

  isFunction(value) {
    return typeof value === 'function';
  },

  extend(obj) {
    for (let i = 1; i < arguments.length; i++) {
      for (let key in arguments[i]) {
        if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
          obj[key] = arguments[i][key];
        }
      }
    }
    return obj;
  },

  createFrame(object) {
    const frame = clientUtils.extend({}, object);
    frame._parent = object;
    return frame;
  },

  isEmpty(value) {
    if (!value && value !== 0) {
      return true;
    } else if (Array.isArray(value) && value.length === 0) {
      return true;
    } else {
      return false;
    }
  },

  findDuplicatesInArray: (arr) => {
    const sorted_arr = arr.slice().sort(); // You can define the comparing function here.
    // JS by default uses a crappy string compare.
    // (we use slice to clone the array so the
    // original array won't be modified)
    const results = [];
    for (let i = 0; i < sorted_arr.length - 1; i++) {
      if (sorted_arr[i + 1] == sorted_arr[i]) {
        results.push(sorted_arr[i]);
      }
    }
    return results;
  },

  getLine: ({ loc }) => {
    return loc ? `${loc.source} ${loc.start.line}:${loc.start.column}` : '';
  },

  getRandomInt: (min = 10000, max = 99999) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  coerceString(value, type) {
    assert(typeof value == 'string');

    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      default:
        throw Error(`Unknown type "${type}"`);
    }
  },

  isStringCoercible(value, types) {
    for (const type of types.split('|')) {
      switch (type) {
        case 'number':
          if (Number(value) != NaN) {
            return true;
          }
          break;
        case 'boolean':
          if (['true', 'false'].includes(value)) {
            return true;
          }
          break;
        default:
          throw Error(`Unknown type "${type}"`);;
      }
    }
    return false;
  }
};
