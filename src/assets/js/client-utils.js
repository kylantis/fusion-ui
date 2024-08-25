
/* eslint-disable no-underscore-dangle */

const tailArrayIndexSegment = /\[[0-9]+\]$/g;
const arrayIndexSegment = /\[[0-9]+\]/g;

// Note: The reason why we are using .+ instead of \w+ is because map keys are actually
// free-form string that can contain anything
const mapKeySegment = /\["\$_.+?"\]/g;

const canonicalArrayIndex = /_\$$/g

const canonicalMapKey = /^\$_$/g
const defaultMapKey = /^\$_\w+$/g

const segment = /(\[[0-9]+\])|(\["\$_.+?"\])/g;
const segmentWithCanonical = /(\[[0-9]+\])|(\["\$_.+?"\])|(_\$)/g;

const internedStringsMetadata = { groupIndexes: {} };


module.exports = {
  tailArrayIndexSegment, arrayIndexSegment, mapKeySegment,

  toFqKey({ isArray, isMap, isDataVariable, prop }) {
    if (isDataVariable === undefined && typeof prop == 'string') {
      isDataVariable = prop.startsWith('@');
    }

    if (isDataVariable) {
      isArray = isMap = false;
    }

    return isArray ? `[${prop}]` : isMap ? `["${prop}"]` : prop;
  },

  toFqPath({ parent, key, type, isArray, isMap, prop }) {
    
    if (!key) {
      switch (true) {
        case Number.isInteger(prop) || type == 'array':
          isArray = true;
          break;
  
        case type == 'map':
          isMap = true;
          break;
      }
  
      key = clientUtils.toFqKey({ isArray, isMap, prop });
    }

    return `${parent}${`${(parent.length && !key.startsWith('[')) ? '.' : ''}${key}`}`;
  },

  getLastSegment(pathArray) {
    if (typeof pathArray == 'string') {
      pathArray = pathArray.split('.');
    };

    const segments = clientUtils.getSegments({ original: pathArray.at(-1) });
    return segments.at(-1);
  },

  getAllSegments(pathArray) {
    if (typeof pathArray == 'string') {
      pathArray = pathArray.split('.');
    };

    const arr = [];

    pathArray.forEach((p, i) => {
      clientUtils.getSegments({ original: p })
        .forEach(s => {
          arr.push(s);
        });
    });

    return arr;
  },

  getPathStringInfo(pathArray) {
    const { mapKeyPrefixRegex } = RootProxy;

    if (typeof pathArray == 'string') {
      pathArray = pathArray.split('.');
    }

    const arr = [...pathArray];
    const lastPart = arr[arr.length - 1];

    const segments = clientUtils.getSegments({ original: lastPart });

    const hasSegments = segments.length > 1;

    const key = hasSegments ?
      clientUtils.getKeyFromIndexSegment(segments.pop()).replace(mapKeyPrefixRegex, '') :
      arr.pop();

    if (hasSegments) {
      arr[arr.length - 1] = segments.join('');
    }

    return {
      parent: arr.join('.'),
      key: clientUtils.isNumber(key) ? Number(key) : key,
    };
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

  randomString: (groupName, length = 8) => {
    const { _internedStringPool } = global;
    const { groupIndexes } = internedStringsMetadata;

    const generateNew = (groupName) => {
      if (groupName) {
        console.warn(
          `_internedStringPool has been exhausted, group "${groupName}" needs a larger pool`
        );
      }

      let result = '';

      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      const charactersLength = characters.length;
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }
      return result;
    }

    if (!groupName || !_internedStringPool) {
      return generateNew();
    }

    if (!groupIndexes[groupName]) {
      groupIndexes[groupName] = -1;
    }

    const idx = groupIndexes[groupName] += 1;

    return _internedStringPool[idx] || generateNew(groupName);
  },

  visitObject(obj, visitor) {
    const { visitObject } = clientUtils;

    if (obj != null && ['Array', 'Object'].includes(obj.constructor.name)) {
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const b = visitor(i, obj[i], obj);
          if (b) {
            visitObject(obj[i], visitor);
          }
        }
      } else {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const b = visitor(key, obj[key], obj);
            if (b) {
              visitObject(obj[key], visitor);
            }
          }
        }
      }
    }
  },

  cloneComponentInputData: (data) => {
    return AppContext.unsafeEval(
      `module.exports=${clientUtils.stringifyComponentData(
        data,
      )}`
    )
  },

  stringifyComponentData: (srcObject) => {
    const replacer = (name, val) => {
      if (val && val.constructor.name === 'Object') {
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

  /**
 * This key is used by <restoreObjectReferences> to maintain object
   references inside the object
 */
  objectReferenceKey: '__objReferenceId',

  restoreObjectReferences: (key, val, objectReferences = {}) => {
    if (val && typeof val == 'object') {
      const refKey = val[clientUtils.objectReferenceKey];

      if (refKey) {
        return objectReferences[refKey] || (objectReferences[refKey] = val);
      }

      if (val['@component']) {
        return new components[`${val['@type']}`]({
          input: val['@data'],
        }, { loadable: val['@loadable'] })
      }
    }
    return val;
  },

  deepClone: (o, objectReferences) => {
    return JSON.parse(
      JSON.stringify(o), (key, val) => clientUtils.restoreObjectReferences(key, val, objectReferences),
    );
  },

  getSegments: ({ original, transform }) => {
    const parts = [];

    const arr = original.split('');

    const buf = [];

    const flushBuf = (transform) => {
      if (buf.length) {
        const p = buf.join('');
        parts.push(
          transform ? transform(p) : p
        );
        buf.splice(0);
      }
    }

    for (let i = 0; i < arr.length; i++) {
      const char = arr[i];

      switch (char) {
        case '[':
          flushBuf();
          buf.push(char);
          break;
        case ']':
          buf.push(char);
          flushBuf(transform);
          break;
        default:
          buf.push(char);
          break;
      }
    }

    flushBuf();
    return parts;
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
      first, ...segments,
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

  getCollectionIndex: (coll, key) => {
    const { isMapProperty, mapIndexOfProperty } = RootProxy;
    assert(
      (Array.isArray(coll) && clientUtils.isNumber(key)) || coll[isMapProperty]
    );

    return Array.isArray(coll) ? Number(key) : coll[mapIndexOfProperty](key);
  },

  getCollectionIndexAndLength: (coll, key) => {
    const { isMapProperty, mapSizeProperty } = RootProxy;

    assert(
      (Array.isArray(coll) && clientUtils.isNumber(key)) || coll[isMapProperty]
    );

    return {
      index: clientUtils.getCollectionIndex(coll, key),
      length: Array.isArray(coll) ? coll.length : coll[mapSizeProperty],
    };
  },

  // Note: This is designed to be used at compile-time, due to the way we validate map keys
  validatePath: (fqPath) => {
    const fqPathArr = fqPath.split('.');

    for (let i = 0; i < fqPathArr.length; i++) {
      const segments = clientUtils.getSegments({ original: fqPathArr[i] });

      for (let j = 0; j < segments.length; j++) {
        const segment = segments[j];

        if (j == 0) {

          let s = segment;

          while (s.match(canonicalArrayIndex)) {
            s = s.replace(canonicalArrayIndex, '');
          }

          if (!s.match(/^\w+$/g) && !s.match(canonicalMapKey) && !s.match(defaultMapKey)) {
            return false;
          }

        } else {
          // Only array indexes should be found here
          if (segment.replace(arrayIndexSegment, '') != '') {
            return false;
          }
        }
      }
    }

    return true;
  },

  getCanonicalSegments: (fqPath) => {

    const fqPathArr = fqPath.split('.');

    const arr = [];
    let p = '';

    // eslint-disable-next-line no-labels
    loop:
    for (let i = 0; i < fqPathArr.length; i++) {

      const segments = clientUtils.getSegments({ original: fqPathArr[i] });

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

    return (typeof fqPath == 'string' ? fqPath.split(separator) : fqPath)
      .map(
        p => clientUtils.getSegments({
          original: p,
          transform: (p) => p.startsWith(`["$_`) ? `${separator}$_` : '_$'
        })
          .map((segment) => segment.startsWith('$_') ? '$_' : segment)
          .join('')
      ).join(separator);
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
    return typeof n == 'number' || !Number.isNaN(parseInt(n, 10))
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

  getLine: (stmt, range = true, useProgramId = false) => {
    const { loc: { programId, source, start, end } = {} } = stmt;

    // Note: we need to do "+ 1" to column because hbs is 0-based but most IDEs are 1-based
    return `${useProgramId ? programId : source} ${start.line}:${start.column + 1}${range ? ` - ${(end.source && end.source != source) ? `${end.source} ` : ''}${end.line}:${end.column + 1}` : ''}`;
  },

  getRandomInt: (min = 10000, max = 99999) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  toHtmlAttrString(attributes) {
    return Array.from(attributes)
      .map(({ name, value }) => {
        if (value.includes("'")) {
          return `${name}="${value}"`;
        } else {
          return `${name}='${value}'`;
        }
      })
      .join(' ');
  },

  wrapPromise(promise) {
    let isResolved = false;
    let isRejected = false;
    let isPending = true;

    const wrappedPromise = promise.then(
      value => {
        isResolved = true;
        isPending = false;
        return value;
      },
      error => {
        isRejected = true;
        isPending = false;
        throw error || Error();
      }
    );

    wrappedPromise.isResolved = () => isResolved;
    wrappedPromise.isRejected = () => isRejected;
    wrappedPromise.isPending = () => isPending;

    return wrappedPromise;
  },

  createThenable: () => ({
    then: function (onFulfilled, onRejected) {
      try {
        onFulfilled();
      } catch (error) {
        if (onRejected) {
          onRejected(error);
        }
      }
    }
  }),

  updateCollChild: async (db, hooklistStoreName, componentId, parent, key, info, timestamp) => {
    const { toFqPath, isNumber, isCanonicalArrayIndex, toCanonicalPath } = clientUtils;

    const { DEFAULT_PRIMARY_KEY: primaryKey } = K_Database;

    const dataPathRoot = 'data';
    const logicGatePathRoot = 'lg';
    const pathSeparator = '__';

    const ARRAY_BLOCK_PATH_INDEX = 'arrayBlockPath_index';


    const isArray = isNumber(key);

    const canonicalParent = toCanonicalPath(parent);

    const path = toFqPath({ isArray, isMap: !isArray, parent, prop: key });
    const newPath = (isArray && (info.index != undefined)) ? toFqPath({ isArray, parent, prop: `${info.index}` }) : null;

    const rows = await db.equalsQuery(hooklistStoreName, ARRAY_BLOCK_PATH_INDEX, path);

    const updates = rows
      .filter(({ [primaryKey]: id, updatedAt }) => id.startsWith(`${componentId}_`) && updatedAt < timestamp)
      .map((row) => {
        const {
          arrayBlockPath, canonicalPath, owner, blockData, blockStack, participants, canonicalParticipants,
        } = row;

        let blockDataKey;

        for (let k of Object.keys(blockData)) {
          if ((k.includes('[') ? toCanonicalPath(k) : k) == canonicalParent) {
            blockDataKey = k;
            break;
          }
        }

        assert(blockDataKey);

        if (newPath) {

          const isknownCanonicalPath = p => p.startsWith(`${canonicalParent}_$`) || isCanonicalArrayIndex(p, parent);

          arrayBlockPath.forEach((p, i) => {
            if (p.startsWith(path)) {
              arrayBlockPath[i] = p.replace(path, newPath);
            }
          });

          if (canonicalPath.startsWith(logicGatePathRoot)) {
            canonicalParticipants.forEach((p, i) => {
              if (
                participants[i].startsWith(path) &&
                isknownCanonicalPath(p.split(pathSeparator).join('.'))
              ) {
                return participants[i] = participants[i].replace(path, newPath);
              }
            });
          } else
            if (
              owner.startsWith(`${dataPathRoot}${pathSeparator}${path}`) &&
              isknownCanonicalPath(canonicalPath.split(pathSeparator).join('.'))
            ) {
              row.owner = owner.replace(path, newPath);
            }

        }

        const updateBlockData = (entry) => {
          assert(entry);

          if (info.index != undefined) {
            entry.index = info.index;
          }

          if (info.length != undefined) {
            entry.length = info.length;
          }
        }

        updateBlockData(blockData[blockDataKey]);

        blockStack
          .filter(({ blockData }) => blockData)
          .forEach(({ blockData }) => {
            const entry = blockData[blockDataKey];
            if (entry) updateBlockData(entry);
          });

        return row;
      });

    await db.put(hooklistStoreName, updates);
  },

  pruneCollChild: async (db, hooklistStoreName, mustachelistStoreName, componentId, parent, key, timestamp) => {
    const { toFqPath, isNumber } = clientUtils;

    const { DEFAULT_PRIMARY_KEY: primaryKey } = K_Database;

    const ARRAY_BLOCK_PATH_INDEX = 'arrayBlockPath_index';

    const isArray = isNumber(key);

    const path = toFqPath({ isArray, isMap: !isArray, parent, prop: key });

    const rows = await db.equalsQuery(hooklistStoreName, ARRAY_BLOCK_PATH_INDEX, path);

    const mustacheRefIds = [];

    const ids = rows
      .filter(({ [primaryKey]: id, updatedAt }) => id.startsWith(`${componentId}_`) && updatedAt < timestamp)
      .map(({ id, mustacheRef }) => {
        if (mustacheRef) {
          mustacheRefIds.push(`${componentId}_${mustacheRef}`);
        }
        return id
      });


    await Promise.all([
      db.delete(hooklistStoreName, ids),
      db.delete(mustachelistStoreName, mustacheRefIds)
    ]);
  }
};
