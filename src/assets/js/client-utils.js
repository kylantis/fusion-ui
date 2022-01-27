
/* eslint-disable no-underscore-dangle */

const anyIndex = /\[[0-9]+\]/g;

module.exports = {
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

  clone: (srcObject) => {
    const replacer = (name, val) => {
      const mapType = 'Map';
      if (val && val.constructor.name === 'Object' && val['@type'] && val['@type'] !== mapType) {
        // This is a component, see toJSON() in BaseRenderer
        const data = JSON.stringify(val['@data'], replacer, 2)
          // Normalize by replacing double quotes to single quotes, so we can inline
          // <data> below
          .replace(/"/g, "'");

        return `%%new components['${val['@type']}']({
          input: ${data},
          loadable: !!self.appContext
        })%%`
          .replace(/\n/g, '');
      }

      return val;
    };
    return JSON.stringify(srcObject, replacer, 2)
      .replace(/("|')%%/g, '')
      .replace(/%%("|')/g, '')
      .replace(/\n/g, '');
  },

  deepClone: (o) => {
    return JSON.parse(JSON.stringify(o));
  },

  getSegments: ({ original }) => {
    const tailIndex = /(\[[0-9]+\])+$/g;

    const indexes = (original.match(tailIndex) || []).join('');

    const segments = [
      original.replace(
        RegExp(`${global.clientUtils.escapeRegExp(indexes)}$`),
        ''
      ),
    ];

    if (indexes.length) {
      indexes.match(anyIndex)
        .forEach(index => segments.push(index))
    }

    return segments;
  },

  toCanonicalPath: (fqPath, separator='.') => {
    return fqPath.split(separator)
      .map(p => global.clientUtils.getSegments({
        original: p,
      }).map((segment) => {
        switch (true) {
          case !!segment.match(anyIndex):
            return '_$';
          case segment.startsWith('$_'):
            return '$_';
          default: return segment;
        }
      }).join('')).join(separator);
  },

  isNumber: (n) => {
    return !Number.isNaN(parseInt(n, 10))
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

  getLine: (stmt) => {
    const { loc: { start } = {} } = stmt;
    return start ? `${start.line}:${start.column}` : '';
  }
};
