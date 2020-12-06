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
const faker = require('faker');
const { assert } = require('quicktype-core');
const helpers = require('./preprocessor-helpers');
const utils = require('./utils');
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

  static reservedProperties = [
    this.typeProperty, this.nameProperty, this.pathProperty, this.valueProperty,
  ];

  constructor({ preprocessor }) {
    const { getWrapper } = PathResolver;

    this.preprocessor = preprocessor;

    this.data = getWrapper({});
    this.schemas = {};

    this.config = this.loadConfig();

    this.literalPaths = [];
    this.processing = true;
  }

  static getLiteralTypes() {
    return ['String', 'Number', 'Boolean'];
  }

  validateConfig({ config }) {
    const { getLiteralTypes } = PathResolver;

    // Validate existing literal types
    for (const k in config.literalTypes) {
      if ({}.hasOwnProperty.call(config.literalTypes, k)) {
        const type = config.literalTypes[k];
        if (!getLiteralTypes().includes(type)) {
          throw new Error(`Unknown type '${type}' for path '${k}', possible values: ${getLiteralTypes()}`);
        }
      }
    }
  }

  loadConfig() {
    const path = this.getConfigPath();
    let config = { superclass: null, typeNames: {}, literalTypes: {} };

    if (fs.existsSync(path)) {
      const data = fs.readFileSync(path, 'utf8');
      config = JSON.parse(data);
      this.validateConfig({ config });
    }
    return config;
  }

  pruneLiteralTypes() {
    for (const k in this.config.literalTypes) {
      if ({}.hasOwnProperty.call(this.config.literalTypes, k)) {
        if (!this.literalPaths.includes(k)) {
          delete this.config.literalTypes[k];
        }
      }
    }
  }

  storeConfig() {
    this.pruneLiteralTypes();
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
          default: return segment;
        }
      }).join(emptyString)).join('.');
  }

  pathExists(original) {
    return !!this.data[original];
  }

  // Todo: Also pass in stmt, if possible
  resolve({ path, create = true }) {
    const { emptyString, literalType, toCanonical } = PathResolver;
    if (path === emptyString) {
      return this.data;
    }

    const arr = path.split('%');
    const fqPath = arr[0];

    // // arr.length === 1
    // if (this.data[fqPath]) {
    //   // Get existing value
    //   const value = this.getRawValue({ original: fqPath });

    //   return toCanonical(value);
    // }

    if (!create) {
      return null;
    }

    let types = [literalType];
    let scopeQualifier;

    if (arr.length > 1) {
      const metaArray = arr[1].split('/');

      types = metaArray[0].split(',');
      // eslint-disable-next-line prefer-destructuring
      scopeQualifier = metaArray[1];
    }

    const value = this.addValue({
      fqPath,
      type: types[0],
      name: scopeQualifier,
    });

    return toCanonical(value);
  }

  // Todo: Ensure property is not included in reservedProperties
  addValue({ fqPath, type, name }) {
    const {
      hasIndex, typeProperty, valueProperty,
      emptyString, componentRefType, getWrapper, getValue,
      literalType, objectType, mapType, createArray,
      arrayType, toCanonical, nameProperty, pathProperty,
      toNumber, toCanonicalPath, getDefaultArrayTypeName,
      getPathRegex
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
                if (canonicalParent.endsWith('_$') && this.config.typeNames[canonicalParent] === undefined) {
                  this.config.typeNames[canonicalParent] = getDefaultArrayTypeName(
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
            this.putValue({
              parent,
              parentWrapper,
              original,
              value,
            });
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

  static getDefaultArrayTypeName(canonicalValue) {
    const { getAlias } = PathResolver;
    return `${getAlias(
      utils.peek(canonicalValue.split('.')).split('_$')[0],
    )}Element`;
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
      case value.constructor.name === 'Object'
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
      typeProperty, componentRefType,
      getRandomWord, getWrapper,
    } = PathResolver;

    switch (type) {
      case objectType:
        return {};
      case arrayType:
        // Arrays are initially represented like this internally. It helps us
        // differentiate an array from array of arrays
        return '[]';
      case mapType:
        const v = {};
        v[getRandomWord()] = getWrapper(emptyString);
        // This overrides the use of constructor.name in getWrapper(...)
        v[typeProperty] = mapType;
        return v;
      case componentRefType:
        const r = {};
        // This overrides the use of constructor.name in getWrapper(...)
        r[typeProperty] = componentRefType;
        return r;
      default:
        return emptyString;
    }
  }

  static getPathRegex(path) {
    return path.replace(new RegExp(`\\[[0-9+]\\]`, 'g'), '\\[[0-9+]\\]')
      .replace('.', '\\.');
  }

  static cloneWrapper(wrapper) {
    const { typeProperty, valueProperty, pathProperty } = PathResolver;
    const newWrapper = {};

    newWrapper[typeProperty] = wrapper[typeProperty];
    newWrapper[valueProperty] = wrapper[valueProperty];
    newWrapper[pathProperty] = wrapper[pathProperty];

    return newWrapper;
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

    const parentPattern = getPathRegex(parent);

    assert(original.match(parentPattern));

    const { typeProperty, valueProperty } = PathResolver;
    const key = `${parent.length ? '' : '.'}${original.replace(
      new RegExp(`^${parentPattern}`),
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

  static getRandomWord() {
    return faker.lorem.word();
  }

  static getAlias(name) {
    // eslint-disable-next-line no-param-reassign
    name = _.camelCase(name);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  static getWrapper(value) {
    const { typeProperty, valueProperty, literalType } = PathResolver;

    let type = value !== Object(value) ? literalType : value.constructor.name;

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

  finalize() {
    this.processing = false;

    this.sample = this.unwrapObject({
      wrapper: utils.deepClone(this.data),
    });

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
      && !this.processing) {
      throw new Error(`Path '${wrapper[pathProperty]}' is redundant and should be removed`);
    }

    const o = {};

    keys.forEach((k) => {
      o[k] = this.getWrappedValue(wrapper[valueProperty][k]);
    });

    if (customType
      // In processing phase, this is needed to indicate the overriden type
      // i.e. when this is a Map
      && this.processing) {
      o[typeProperty] = customType;
    }

    return o;
  }

  getConfigPath() {
    const path = pathLib
      .join(this.preprocessor.srcDir, 'config.json');
    return path;
  }

  static getLiteralValue({ type }) {
    const { getRandomWord } = PathResolver;
    switch (type) {
      case 'Boolean': return true;
      case 'Number': return utils.getRandomInt(1, 10);
      case 'String': default: return getRandomWord();
    }
  }

  getComponent({ className }) {
    return this.preprocessor.getSerializedComponent(className);
  }

  // Figure out sample generation for component refs
  getWrappedValue(wrapper) {
    const {
      typeProperty, nameProperty, valueProperty, pathProperty,
      objectType, arrayType, literalType, componentRefType,
      mapType, getLiteralValue,
    } = PathResolver;
    const path = wrapper[pathProperty];

    switch (wrapper[typeProperty]) {
      case componentRefType:
        const className = wrapper[nameProperty];
        return this.getComponent({ className });
      case mapType:
      case objectType:
        return this.unwrapObject({ wrapper });
      case arrayType:
        return wrapper[valueProperty].map(this.getWrappedValue, this);
      case literalType:
      default:
        if (wrapper[valueProperty] === '[]') {
          if (
            // This redundancy check only applies when processing is complete
            !this.processing) {
            throw new Error(`Path '${path}' is redundant and should be removed`);
          }
          // '[]' will be used by toCanonical(...) to indicate that this is an array
          return wrapper[valueProperty];
        }

        if (!this.config.literalTypes[path]) {
          this.config.literalTypes[path] = 'String';
        }

        return getLiteralValue({ type: this.config.literalTypes[path] });
    }
  }
}

module.exports = PathResolver;
