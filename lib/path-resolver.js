/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
/* eslint-disable no-plusplus */
/* eslint-disable no-eval */
/* eslint-disable no-labels */
/* eslint-disable no-continue */
/* eslint-disable default-case */
/* eslint-disable no-restricted-syntax */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-case-declarations */

const fs = require('fs');
const pathLib = require('path');
const _ = require('lodash');
const randomstring = require("randomstring");
const helpers = require('./preprocessor-helpers');
const utils = require('./utils');
const assert = require('assert');
class PathResolver {
  static emptyObject = {};

  static emptyString = '';

  static hasIndex = /\[[0-9]+\]/g;

  static typeProperty = '@type';

  static nameProperty = '@name';

  static pathProperty = '@path';

  static valueProperty = '@value';

  static literalType = 'Literal';

  static arrayType = 'Array';

  static objectType = 'Object';

  static mapType = 'Map';

  static componentRefType = 'componentRef';

  static defaultCollectionSize = 5;

  static reservedProperties = [
    this.typeProperty, this.nameProperty, this.pathProperty, this.valueProperty,
  ];

  static mapDefaultKey = `$_${PathResolver.getRandomWord()}`;

  constructor({ preprocessor }) {
    const { getWrapper } = PathResolver;

    this.preprocessor = preprocessor;

    this.data = getWrapper({});
    this.schemas = {};

    this.enums = this.loadEnums();
    this.config = this.loadConfig();

    this.literalPaths = [];
    this.processing = true;
  }

  static getLiteralTypes() {
    return ['String', 'Number', 'Boolean'];
  }

  loadEnums() {

    const path = pathLib.join(process.env.PWD, 'src', 'components', 'enums.json');
    let enums = {};

    if (fs.existsSync(path)) {
      const data = fs.readFileSync(path, 'utf8');
      enums = JSON.parse(data);
    }

    return enums;
  }

  loadConfig() {
    const path = this.getConfigPath();
    let config = { superclass: null, collections: {}, literals: {} };

    if (fs.existsSync(path)) {
      const data = fs.readFileSync(path, 'utf8');
      config = JSON.parse(data);
    }

    // Substitute variables, if necessary
    this.substituteEnums(config);

    return config;
  }

  substituteEnums(config) {

    const getVariable = (name, validType) => {
      assert(
        Object.keys(this.enums).includes(name),
        `Unknown enum: ${name}`
      );

      const value = this.enums[name];
      assert(
        !validType || value.constructor.name == validType,
        `Expected ${name} to resolve to have type: ${validType}, not ${value.constructor.name}`
      );

      return value;
    }

    Object.entries(config.literals).forEach(([key, value]) => {

      if (typeof value.allowed == 'string') {
        const variableName = value.allowed;
        value.allowed = getVariable(variableName, 'Array');
        value.allowed.variableName = variableName;
      }

    });
  }

  unsubstituteEnums(config) {

    Object.entries(config.literals).forEach(([key, value]) => {
      if (value.allowed && value.allowed.variableName) {
        value.allowed = value.allowed.variableName;
      }
    });
  }

  static toRealPath(path) {
    const { mapDefaultKey } = PathResolver;
    return path.replace(/_\$/g, '[0]').replace(/\$_/g, mapDefaultKey)
  }

  pruneConfig() {

    for (const k in this.config.collections) {
      if ({}.hasOwnProperty.call(this.config.collections, k)) {

        const { typeProperty, arrayType, mapType, toRealPath } = PathResolver;

        let wrapper = this.data[toRealPath(k)];

        if (wrapper && ![arrayType, mapType].includes(wrapper[typeProperty])) {
          wrapper = false;
        }

        if (!wrapper) {
          // Cleanup redundant
          delete this.config.collections[k];
        }
      }
    }

    for (const k in this.config.literals) {
      if ({}.hasOwnProperty.call(this.config.literals, k)) {
        if (!this.literalPaths.includes(k)) {
          delete this.config.literals[k];
        }
      }
    }
  }

  storeConfig() {
    this.pruneConfig();

    this.unsubstituteEnums(this.config);

    fs.writeFileSync(
      this.getConfigPath(),
      JSON.stringify(this.config, null, 2),
    );
  }

  static toCanonicalPath(fqPath) {
    const { hasIndex, emptyString } = PathResolver;
    const { getSegments } = helpers;
    return fqPath.split('.')
      .map(p => getSegments({
        original: p,
      }).map((segment) => {
        switch (true) {
          case !!segment.match(hasIndex):
            return '_$';
          case segment.startsWith('$_'):
            return '$_';
          default: return segment;
        }
      }).join(emptyString)).join('.');
  }

  // Todo: Also pass in stmt, if possible
  resolve({ path, create = true }) {
    const {
      emptyString, literalType, arrayType, mapType, defaultCollectionSize,
      toCanonical, getRandomWord, getValue, toCanonicalPath
    } = PathResolver;
    const { getDataVariables } = this.preprocessor.constructor;
    if (path === emptyString) {
      return this.data;
    }

    const arr = path.split('%');
    const fqPath = arr[0];

    if (fqPath.match(/\[\'@\w+\'\]$/g)) {
      // This is a data variable
      assert(
        getDataVariables()
          .map(v => `['${v}']`)
          .includes(fqPath.match(/\[\'@\w+\'\]$/g)[0])
      )
      return getRandomWord();
    }

    let types = [literalType];
    let scopeQualifier;

    if (arr.length > 1) {
      const metaArray = arr[1].split('/');

      types = metaArray[0].split(',');
      // eslint-disable-next-line prefer-destructuring
      scopeQualifier = metaArray[1];
    }

    if (this.data[fqPath]) {

      // Get existing value
      let value = this.getRawValue({ original: fqPath });

      if (
        [arrayType, mapType].includes(types[0]) &&
        value !== Object(value)
      ) {

        // Since <fqPath> is a Literal, and we are trying to
        // access it like a collection, automatically update it
        // to a collection. This is needed especially important
        // for nested collections

        value = getValue({ type: types[0] });

        // update <fqPath> value from literal, to an array/map
        this.updateValue({ original: fqPath, value });

        const canonicalPath = toCanonicalPath(fqPath);

        // Add to collections config, if necessary
        const config = this.config.collections[canonicalPath] ||
          (this.config.collections[canonicalPath] = {})

        if (config.minLength == undefined) {
          config.minLength = defaultCollectionSize;
        }

      }

      return toCanonical(value);
    }

    if (!create) {
      return null;
    }

    const type = types[0];

    const value = this.addValue({
      fqPath,
      type,
      name: scopeQualifier,
    });

    return toCanonical(value);
  }

  // static removeLiteralPath(path) {

  //     assert(this.literalPaths.includes(canonicalPath));

  //     this.literalPaths.splice(
  //       this.literalPaths.indexOf(canonicalPath), 1
  //     );
  // }


  // Todo: Ensure property is not included in reservedProperties
  addValue({ fqPath, type, name }) {
    const {
      hasIndex, typeProperty, valueProperty,
      emptyString, componentRefType, getWrapper, getValue,
      literalType, objectType, mapType, createArray,
      arrayType, toCanonical, nameProperty, pathProperty,
      toNumber, toCanonicalPath, getDefaultCollectionTypeName,
      getPathRegex, defaultCollectionSize
    } = PathResolver;
    const {
      getSegments,
    } = helpers;

    const fqPathArr = fqPath.split('.');

    let original = emptyString;

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < fqPathArr.length; i++) {
      const segments = getSegments({
        original: fqPathArr[i],
      });

      // eslint-disable-next-line no-labels
      loop:
      // eslint-disable-next-line no-plusplus
      for (let j = 0; j < segments.length; j++) {
        const segment = segments[j];

        const parent = original;
        const canonicalParent = toCanonicalPath(parent);

        const parentWrapper = parent.length ? this.data[parent] : this.data;

        if (parentWrapper[typeProperty] === componentRefType) {
          const arr = parent.split('.');
          const alias = arr[arr.length - 1];
          throw new Error(`Component reference: ${alias} cannot have a sub path`);
        }

        original += `${i === 0 || j > 0 ? emptyString : '.'}${segment}`;

        const existingWrapper = this.data[original];

        if (existingWrapper &&
          // Due to it's highly volatile structure, we always need to
          // process array-index - based originals
          !segment.match(hasIndex)
        ) {
          const existingValue = toCanonical(existingWrapper[valueProperty]);

          const newValue = toCanonical(getValue({ type }));
          switch (true) {

            case
              // This is not a terminal segment, hence continue to the next segment
              // while allowing subsequent segments to enforce type constraints
              i < fqPathArr.length - 1 || j < segments.length - 1
              // This is a literal, hence continue to next segment as there is
              // an existing wrapper
              || newValue !== Object(newValue)
              // existingValue and newValue have the same type
              || existingValue.constructor.name === newValue.constructor.name:
              continue loop;

            case existingValue.constructor.name !== newValue.constructor.name
              && existingValue === Object(existingValue)
              && newValue === Object(newValue):
              // Object / Map / Array values cannot be used interchangeably
              // for similar paths
              throw new Error(`${original} is an ${existingValue.constructor.name} not ${newValue.constructor.name} - ${fqPath}`);

            default:
              // In this case, newValue is either an object or array and
              // the existingValue is a literal, hence we can proceed to update the existing value
              break;
          }
        }

        let putValue = true;
        let valueOverride;

        let newArray = false;
        let originals = [original];

        switch (true) {
          case segment === 'length':
            putValue = false;
          // eslint-disable-next-line no-fallthrough
          case !!segment.match(hasIndex):

            const addOriginals = (length) => {

              const getIndexSegment = (str) => {
                const arr = str.split('.');

                const segments = getSegments({
                  original: arr[arr.length - 1],
                });
                const segment = utils.peek(segments);
                return segment.match(hasIndex) ? segment : null;
              }

              let p = parent;
              let segment;
              let indices = [];

              while ((segment = getIndexSegment(p)) !== null) {
                const i = toNumber({ segment });
                p = p.replace(new RegExp(`\\[${i}\\]$`), '');

                const l = this.data[p][valueProperty].length;

                indices.unshift(l);
              }

              let prefixes;

              if (indices.length) {

                const recurse = (arr, indices) => {

                  const l = indices.shift();

                  if (!arr.length) {
                    for (let i = 0; i < l; i++) {
                      arr[i] = `[${i}]`;
                    }
                  } else {

                    // Clone arr and iterate that instead, so we can modify
                    // arr in place without any side effects
                    const arr2 = utils.deepClone(arr);
                    let k = 0;

                    for (let i = 0; i < arr2.length; i++) {
                      const repl = [];

                      for (let j = 0; j < l; j++) {
                        repl.push(`${arr2[i]}[${j}]`);
                      }

                      arr.splice(k, 1, ...repl);
                      k += repl.length;
                    }
                  }

                  if (indices.length) {
                    recurse(arr, indices);
                  }
                }

                const arr = [];
                recurse(arr, indices);

                prefixes = arr.map(r => `${p}${r}`);
              } else {
                prefixes = [p];
              }

              for (let i = 0; i < prefixes.length; i++) {
                for (let j = 0; j < length; j++) {
                  const o = `${prefixes[i]}[${j}]`;
                  if (!this.data[o]) {
                    originals.push(o);
                  }
                }
              }

            }

            const addChildren = () => {

              const keys = Object.keys(this.data)
                .filter(k => k !== `${parent}[0]` && k.startsWith(`${parent}[0]`));

              const p = new RegExp(`^${getPathRegex(`${parent}[0]`)
                }`);

              keys.forEach(key => {
                this.data[
                  key.replace(p, `${parent}${segment}`)
                ] = this.data[key];
              });
            }

            if (!this.data[`${parent}[0]`]) {
              newArray = true;
            }

            switch (parentWrapper[typeProperty]) {
              case literalType:
                // update parent value from literal, to an array
                const arr = createArray({
                  length: toNumber({ segment }) + 1,
                });

                if (this.config.collections[canonicalParent] == undefined) {
                  this.config.collections[canonicalParent] = {
                    minLength: defaultCollectionSize,
                  }
                }

                this.updateValue({
                  original: parent,
                  value: arr,
                });

                addOriginals(arr.length);

                break;

              case objectType:
                throw new Error(`${parent} is an object, and cannot be accessed like an array - ${fqPath}`);

              case mapType:
                throw new Error(`${parent} is a map, and cannot be accessed like an array - ${fqPath}`);

              case arrayType:
                if (segment !== 'length') {
                  const existingArray = parentWrapper[valueProperty];

                  if (newArray) {
                    // We expect the preceeding array to be an array of array

                    // eslint-disable-next-line default-case
                    switch (existingArray[0][typeProperty]) {
                      case literalType:
                        // update from array of literal, to an array of array

                        const arr = createArray({
                          length: toNumber({ segment }) + 1,
                        });

                        this.updateValue({
                          original: parent,
                          value: [
                            getWrapper(arr)],
                        });

                        addOriginals(arr.length);

                        break;

                      case objectType:
                        throw new Error(`${parent} is an array of objects, and cannot be accessed like an array of literals - ${fqPath}`);
                      case mapType:
                        throw new Error(`${parent} is an array of maps, and cannot be accessed like an array of literals - ${fqPath}`);
                    }
                  } else {

                    // The array has been accessed before, so we need to maintain reference
                    // to the existing value
                    valueOverride = existingArray[0][valueProperty];

                    const existingLength = existingArray.length;

                    const newLength = toNumber({ segment }) + 1;
                    if (existingLength < newLength) {
                      // eslint-disable-next-line no-shadow
                      for (let i = existingLength; i < newLength; i++) {
                        existingArray[i] = existingArray[i - 1];
                      }
                    }

                    addOriginals(newLength);

                    // If sub-indexes exists, add those for this index
                    addChildren();
                  }
                }
                break;
              default:
                throw new Error(`Unknown type: ${parentWrapper[typeProperty]}`);
            }

            break;

          default:

            // eslint-disable-next-line default-case
            switch (parentWrapper[typeProperty]) {
              case literalType:
                // update parent value from literal, to an object
                this.updateValue({ original: parent, value: {} });

                const canonicalParent = toCanonicalPath(parent);

                if (
                  // Array
                  canonicalParent.endsWith('_$') ||
                  // Map
                  canonicalParent.endsWith('.$_')
                ) {

                  const path = canonicalParent
                    // Array
                    .replace(/_\$$/g, '')
                    // Map
                    .replace(/\.\$_$/g, '');

                  assert(!!this.config.collections[path]);

                  this.config.collections[path].singularType =
                    this.config.collections[path].singularType ||
                    getDefaultCollectionTypeName(
                      canonicalParent,
                    );
                }

                break;

              case objectType:
                break;

              case mapType:
                const k = original.replace(parent, emptyString).replace(/^\./g, '');
                if (parentWrapper[valueProperty][k] === undefined) {
                  throw new Error(`Unknown property: ${k}. ${parent} is a map, and cannot be accessed like an object - ${fqPath}`);
                }

                break;

              case arrayType:
                throw new Error(`${parent} is an array, and cannot be accessed like an object - ${fqPath}`);
            }

            break;
        }

        if (putValue) {
          const value = valueOverride || getValue({
            type:
              // If this is not the terminal segment, use literalType instead
              (i < (fqPathArr.length - 1) || j < (segments.length - 1)) ? literalType
                : type,
          });

          [...new Set(originals)].forEach(original => {

            const { mapType } = PathResolver;

            this.putValue({
              parent,
              parentWrapper,
              original,
              value,
            });

            if (value[typeProperty] == mapType) {

              const canonicalPath = toCanonicalPath(original);

              const config = this.config.collections[canonicalPath] ||
                (this.config.collections[canonicalPath] = {})

              if (config.minLength == undefined) {
                config.minLength = defaultCollectionSize;
              }
            }
          });
        }
      }
    }

    assert(fqPath === original);

    const wrapper = this.data[original];

    if (wrapper[typeProperty] === literalType) {
      this.literalPaths.push(wrapper[pathProperty]);
    }

    if (name && !wrapper[nameProperty]) {
      wrapper[nameProperty] = name;
    }

    return this.getRawValue({ original });
  }

  static getDefaultCollectionTypeName(canonicalPath) {
    const { getAlias } = PathResolver;

    let typeName;

    if (canonicalPath.endsWith('_$')) {
      // Array
      typeName = utils.peek(canonicalPath.split('.'))
        .split('_$')[0];
    } else {
      // Map
      typeName = utils.peek(
        canonicalPath.split('.$_')[0].split('.')
      );
    }

    return `${getAlias(typeName)}Element`;
  }

  static createArray({ length }) {
    const { getWrapper, emptyString } = PathResolver;

    const arr = [];

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < length; i++) {
      arr[i] = i === 0 ? getWrapper(emptyString) : arr[0];
    }
    return arr;
  }

  getRawValue({ original }) {
    const wrapper = this.data[original];
    const value = wrapper ? this.getWrappedValue(utils.deepClone(wrapper)) : null;

    return value;
  }

  static toCanonical(value) {
    const {
      typeProperty, mapType,
    } = PathResolver;
    switch (true) {
      case value === '[]':
        return [];
      case value && value.constructor.name === 'Object'
        && !!value[typeProperty]:

        switch (true) {
          case value[typeProperty] === mapType:
            const map = new Map();
            const keys = Object.keys(value)
              .filter(k => k !== typeProperty);
            for (const k of keys) {
              map.set(k, value[k]);
            }
            return map;
        }

      // eslint-disable-next-line no-fallthrough
      default:
        return value;
    }
  }

  static getValue({ type }) {
    const {
      emptyString, objectType, arrayType, mapType,
      typeProperty, componentRefType, mapDefaultKey,
      getWrapper,
    } = PathResolver;

    switch (type) {
      case objectType:
        return {};

      case arrayType:
        // Arrays are initially represented like this internally. It helps us
        // differentiate an array from array of arrays
        return '[]';

      case mapType:
        return {
          [mapDefaultKey]: getWrapper(emptyString),
          // This overrides the use of constructor.name in getWrapper(...)
          [typeProperty]: mapType
        };

      case componentRefType:
        return {
          // This overrides the use of constructor.name in getWrapper(...)
          [typeProperty]: componentRefType
        };

      default:
        return emptyString;
    }
  }

  static getPathRegex(path) {
    return path
      .replace(new RegExp(`\\[[0-9+]\\]`, 'g'), '\\[[0-9+]\\]')
      // '$_' is prefixed to map keys
      .replaceAll('$_', '\\$_')
      .replaceAll('.', '\\.');
  }

  putValue({
    // eslint-disable-next-line no-unused-vars
    parent, parentWrapper, original, value,
  }) {
    const {
      // eslint-disable-next-line no-unused-vars
      getWrapper, emptyString, pathProperty, toCanonicalPath,
      getPathRegex,
    } = PathResolver;

    const parentPattern = new RegExp(`^${getPathRegex(parent)}`);

    assert(original.match(parentPattern));

    const { typeProperty, valueProperty } = PathResolver;
    const key = `${parent.length ? '' : '.'}${original.replace(
      parentPattern,
      emptyString
    )}`;

    const lhs = `parentWrapper['${valueProperty}']${key}`;
    const rhs = 'getWrapper(value)';

    const existingWrapper = eval(lhs);
    if (existingWrapper) {
      const newWrapper = eval(rhs);

      existingWrapper[typeProperty] = newWrapper[typeProperty];
      existingWrapper[valueProperty] = newWrapper[valueProperty];
    } else {
      eval(`${lhs} = ${rhs}`);
    }

    eval(`this.data["${original}"] = ${lhs}`)[pathProperty] = toCanonicalPath(original);
  }

  static toNumber({ segment }) {
    return Number(
      segment.replace('[', '').replace(']', ''),
    );
  }

  updateValue({ original, value }) {
    const {
      typeProperty, valueProperty, pathProperty, toCanonicalPath, getWrapper,
    } = PathResolver;
    const wrapper = this.data[original];
    // eslint-disable-next-line no-param-reassign
    value = getWrapper(value);
    wrapper[typeProperty] = value[typeProperty];
    wrapper[valueProperty] = value[valueProperty];

    const path = toCanonicalPath(original);
    assert((!wrapper[pathProperty]) || wrapper[pathProperty] === path);

    wrapper[pathProperty] = path;
  }

  static getRandomWord(length = 10) {
    return randomstring.generate({
      length,
      charset: 'abcdefghilmnoprstu',
      readable: true,
    }).match(/.{1,10}/g).join(' ');
  }

  static getAlias(name) {
    // eslint-disable-next-line no-param-reassign
    name = _.camelCase(name);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  static getType(value) {
    const { literalType } = PathResolver;
    return value !== Object(value) ? literalType : value.constructor.name;
  }

  static getWrapper(value) {
    const { typeProperty, valueProperty, getType } = PathResolver;

    let type = getType(value);

    if (value[typeProperty]) {
      type = value[typeProperty];
    }

    const o = {};
    o[typeProperty] = type;
    o[valueProperty] = value;

    return o;
  }

  getSample() {
    return utils.deepClone(this.sample);
  }

  /**
   * During the course of processing, we usually add singularType
   * to the config when necessary, but not prune them as necessary.
   * This method looks for collections that are neither object
   * arrays nor object maps, and removes the singularType property 
   */
  pruneSingularTypes() {
    const {
      typeProperty, arrayType, mapType, valueProperty, objectType,
      mapDefaultKey, toRealPath,
    } = PathResolver;

    const isObjectArray = (wrapper) =>
      wrapper[typeProperty] == arrayType &&
      wrapper[valueProperty][0][typeProperty] == objectType

    const isObjectMap = (wrapper) =>
      wrapper[typeProperty] == mapType &&
      wrapper[valueProperty][mapDefaultKey][typeProperty] == objectType

    for (const key in this.config.collections) {
      const wrapper = this.data[toRealPath(key)];
      if (
        !isObjectArray(wrapper) &&
        !isObjectMap(wrapper)
      ) {
        delete this.config.collections[key].singularType
      }
    }
  }

  finalize() {
    this.processing = false;

    this.sample = this.unwrapObject({
      wrapper: utils.deepClone(this.data),
    });

    this.pruneSingularTypes();

    this.storeConfig();

    return { data: this.data, config: this.config }
  }

  unwrapObject({ wrapper }) {
    const {
      valueProperty, pathProperty, typeProperty,
    } = PathResolver;

    let customType;
    // eslint-disable-next-line no-cond-assign
    if (customType = wrapper[valueProperty][typeProperty]) {
      // eslint-disable-next-line no-param-reassign
      delete wrapper[valueProperty][typeProperty];
    }

    const keys = Object.keys(wrapper[valueProperty]);

    if (wrapper !== this.data && !keys.length
      // This redundancy check only applies when processing is complete
      && !this.processing
      // should not be triggered on the root wrapper
      && wrapper[pathProperty]
    ) {

      // For maps, we always include a default entry, so this
      // is guaranteed to not be a map
      assert(!customType);

      throw new Error(`Path '${wrapper[pathProperty]}' is redundant and should be removed`);
    }

    const o = {};

    keys.forEach((key) => {
      o[key] = this.getWrappedValue(wrapper[valueProperty][key]);
    });

    if (customType) {
      o[typeProperty] = customType;
    }

    return o;
  }

  getConfigPath() {
    const path = pathLib
      .join(this.preprocessor.srcDir, 'config.json');
    return path;
  }

  static getLiteralValue({ path, config }) {
    const { toNumber, findDuplicatesInArray } = PathResolver;
    let { type, defaultValue, defaults = [], allowed = [] } = config;
    let length = 10;

    if (type.startsWith('String')) {

      // Todo: add more advanced directives line > <
      const lRegex = /\[[0-9]+\]$/g;
      const match = type.match(lRegex);

      if (match) {
        const len = toNumber({ segment: match[0] });

        // verify that defaults and allowed (if specified) also conform to the
        // length constraint specified
        [...defaults, ...allowed].forEach(v => {
          if (v.length != len) {
            throw Error(`[${path}] Value '${v}' has illegal length: ${v.length}`);
          }
        });

        length = len;
        type = type.replace(lRegex, '');
      }
    } else {
      assert(!defaults.length && !allowed.length, `[${path}]: Incorrect signature: ${JSON.stringify(config)}`);
    }

    if (allowed.length && defaults.length &&
      defaults.filter(v => !allowed.includes(v)).length) {
      throw Error(`[${path}] Unknown value in defaults: ${defaults}`);
    }

    const checkDuplicates = (property) => {
      const arr = config[property] || [];
      if (arr.length) {
        const duplicates = findDuplicatesInArray(arr);
        if (duplicates.length) {
          throw Error(`[${path}] Duplicate(s) found in '${property}': ${JSON.stringify(duplicates)}`);
        }
      }
    }

    checkDuplicates('allowed');
    checkDuplicates('defaults');

    const setDefaultValue = ({ defaults }) => {
      if (defaultValue == undefined) {
        defaultValue = defaults[
          utils.getRandomInt(0, defaults.length - 1)
        ]
      }
    }

    const { getRandomWord } = PathResolver;

    switch (type) {

      case 'Boolean':
        setDefaultValue({ defaults: [true, false] });
        assert(typeof defaultValue == 'boolean');
        return defaultValue;

      case 'Number':
        setDefaultValue({ defaults: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
        assert(typeof defaultValue == 'number');
        return defaultValue;

      case 'String':

        switch (true) {
          case !!allowed.length:
            if (defaults.length) {
              return defaults[
                utils.getRandomInt(0, defaults.length - 1)
              ];
            } else {
              return null
            }
          default:
            return getRandomWord(length);
        }

      default:
        throw new Error(`[${path}] Unknown type: ${type}`);
    }
  }

  getComponent({ className }) {
    return this.preprocessor.getSerializedComponent(className);
  }

  getWrappedValue(wrapper) {
    const {
      typeProperty, nameProperty, valueProperty, pathProperty,
      objectType, arrayType, literalType, componentRefType,
      mapType, mapDefaultKey, getRandomWord, getLiteralValue,
    } = PathResolver;

    const path = wrapper[pathProperty];

    const { minLength } = this.config.collections[path] || {};

    switch (wrapper[typeProperty]) {
      case componentRefType:
        const className = wrapper[nameProperty];
        return this.getComponent({ className });

      case objectType:
        return this.unwrapObject({ wrapper });

      case mapType:

        const mapObject = this.unwrapObject({ wrapper });

        if (this.processing) {
          return mapObject;
        }

        const mapKeys = Object.keys(mapObject).filter(k => k !== typeProperty);
        const newObject = {};

        assert(minLength !== undefined);
        assert(mapKeys.length == 1 && mapKeys[0] == mapDefaultKey);

        for (let i = 0; i < minLength; i++) {
          newObject[`$_${getRandomWord()}`] = mapObject[mapKeys[0]];
        }

        if (mapObject[typeProperty]) {
          newObject[typeProperty] = mapObject[typeProperty];
        }

        return newObject;

      case arrayType:

        assert(minLength !== undefined);

        const arr = wrapper[valueProperty];

        const len = arr.length > minLength ? arr.length : minLength;
        const newArray = [];

        for (let i = 0; i < len; i++) {
          newArray.push(arr[0]);
        }

        return newArray.map(this.getWrappedValue, this);

      case literalType:
      default:
        if (wrapper[valueProperty] === '[]') {
          // '[]' will be used by toCanonical(...) to indicate that this is an array

          // In TemplateProcessor, due to the way we usually call lookupDataPath(...) 
          // to fetch the 0th index, just after looking up an array, it is guaranteed
          // that this will not exist after processing is complete
          assert(this.processing);

          return wrapper[valueProperty];
        }

        if (path) {

          if (!this.config.literals[path]) {
            this.config.literals[path] = { type: 'String' };
          }
          return getLiteralValue({ path, config: this.config.literals[path] });

        } else {
          // This is a map default key
          return getRandomWord();
        }
    }
  }

  static findDuplicatesInArray(arr) {
    let sorted_arr = arr.slice().sort(); // You can define the comparing function here.
    // JS by default uses a crappy string compare.
    // (we use slice to clone the array so the
    // original array won't be modified)
    let results = [];
    for (let i = 0; i < sorted_arr.length - 1; i++) {
      if (sorted_arr[i + 1] == sorted_arr[i]) {
        results.push(sorted_arr[i]);
      }
    }
    return results;
  }
}

module.exports = PathResolver;
