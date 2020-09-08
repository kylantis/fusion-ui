/* eslint-disable no-plusplus */
/* eslint-disable no-eval */
/* eslint-disable no-labels */
/* eslint-disable no-continue */
/* eslint-disable default-case */
/* eslint-disable no-restricted-syntax */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-case-declarations */

const faker = require('faker');
const { assert } = require('quicktype-core');
const helpers = require('./preprocessor-helpers');

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

  constructor({ componentName, path }) {
    const { getWrapper } = PathResolver;

    this.componentName = componentName;
    this.path = path;

    this.fqPaths = {};
    this.data = getWrapper({});
  }

  resolve(path) {
    const { toCanonical, emptyString } = PathResolver;
    if (path === emptyString) {
      return this.data;
    }

    const arr = path.split('%');
    const fqPath = arr[0];

    // arr.length === 1
    if (this.fqPaths[fqPath]) {
      // Get existing value
      const original = this.fqPaths[fqPath];
      const value = this.getRawValue({ original });

      return toCanonical(value);
    }

    const metaArray = arr[1].split('/');

    const types = metaArray[0].split(',');
    // eslint-disable-next-line no-unused-vars
    const scopeQualifier = metaArray[1];

    const value = this.addValue({
      fqPath,
      type: types[0],
      name: scopeQualifier,
    });

    return toCanonical(value);
  }

  addValue({ fqPath, type, name }) {
    const {
      hasIndex, typeProperty, valueProperty,
      emptyString, getWrapper, getValue,
      literalType, objectType, mapType, createArray,
      arrayType, toCanonical, nameProperty, pathProperty,
      toNumber,
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

        original += `${i === 0 || j > 0 ? emptyString : '.'}${segment}`;

        const existingWrapper = this.data[original];

        if (existingWrapper) {
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
        let replica;

        switch (true) {
          case segment === 'length':
            putValue = false;
          // eslint-disable-next-line no-fallthrough
          case !!segment.match(hasIndex):

            if (!this.data[`${parent}[0]`]) {
              replica = `${parent}[0]`;
            }

            switch (parentWrapper[typeProperty]) {
              case literalType:

                // update parent value from literal, to an array
                this.updateValue({
                  original: parent,
                  value: createArray({
                    length: toNumber({ segment }) + 1,
                  }),
                });

                break;

              case objectType:
                throw new Error(`${parent} is an object, and cannot be accessed like an array - ${fqPath}`);

              case mapType:
                throw new Error(`${parent} is a map, and cannot be accessed like an array - ${fqPath}`);

              case arrayType:

                if (segment !== 'length') {
                  const existingArray = parentWrapper[valueProperty];

                  if (replica) {
                    // We expect the preceeding array to be an array of array

                    // eslint-disable-next-line default-case
                    switch (existingArray[0][typeProperty]) {
                      case literalType:
                      // update from array of literal, to an array of array
                        this.updateValue({
                          original: parent,
                          value: [
                            getWrapper(createArray({
                              length: toNumber({ segment }) + 1,
                            })),
                          ],
                        });
                        break;

                      case objectType:
                        throw new Error(`${parent} is an array of objects, and cannot be accessed like an array of arrays - ${fqPath}`);

                      case mapType:
                        throw new Error(`${parent} is an array of maps, and cannot be accessed like an array of arrays - ${fqPath}`);
                    }
                  } else {
                    const existingLength = existingArray.length;
                    const newLength = toNumber({ segment }) + 1;
                    if (existingLength < newLength) {
                      // eslint-disable-next-line no-shadow
                      for (let i = existingLength; i < newLength; i++) {
                        existingArray[i] = existingArray[i - 1];
                      }
                    }
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
          const value = getValue({ type });

          this.putValue({
            parent,
            parentWrapper,
            original,
            value,
          });

          if (replica && replica !== original) {
            this.putValue({
              parent,
              parentWrapper,
              original: replica,
              value,
            });
          }
        }
      }
    }

    assert(fqPath === original);

    const wrapper = this.data[original];
    wrapper[pathProperty] = fqPath;
    if (name && !wrapper[nameProperty]) {
      wrapper[nameProperty] = name;
    }

    this.fqPaths[fqPath] = original;
    return this.getRawValue({ original });
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
    const { valueProperty } = PathResolver;
    const value = this.data[original] ? this.data[original][valueProperty] : null;
    return value instanceof Array ? [value[0][valueProperty]] : value;
  }

  static toCanonical(value) {
    const { typeProperty, mapType } = PathResolver;
    switch (true) {
      case value === '[]':
        return [];
      case value.constructor.name === 'Object'
        && !!value[typeProperty]:
        assert(value[typeProperty] === mapType);
        const map = new Map();
        const keys = Object.keys(value)
          .filter(k => k !== typeProperty);
        for (const k of keys) {
          map.set(k, value[k]);
        }
        return map;
      default:
        return value;
    }
  }

  static getValue({ type }) {
    const {
      emptyString, objectType,
      arrayType, mapType, typeProperty,
      getRandomWord, getWrapper,
    } = PathResolver;

    switch (type) {
      case objectType:
        return {};
      case arrayType:
        // Arrays are initially represented like this internally. It helps us
        // differentiate arrays from array
        return '[]';
      case mapType:
        const v = {};
        v[getRandomWord()] = getWrapper(emptyString);
        // This is override the use of constructor.name in getWrapper(...)
        v[typeProperty] = mapType;
        return v;
      default:
        return emptyString;
    }
  }

  putValue({
    // eslint-disable-next-line no-unused-vars
    parent, parentWrapper, original, value,
  }) {
    // eslint-disable-next-line no-unused-vars
    const { getWrapper, emptyString } = PathResolver;

    const { typeProperty, valueProperty } = PathResolver;
    const key = `${parent.length ? '' : '.'}${original.replace(parent, emptyString)}`;

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

    eval(`this.data["${original}"] = ${lhs}`);
  }

  static toNumber({ segment }) {
    return Number(
      segment.replace('[', '').replace(']', ''),
    );
  }

  updateValue({ original, value }) {
    const { getWrapper, typeProperty, valueProperty } = PathResolver;
    const wrapper = this.data[original];
    // eslint-disable-next-line no-param-reassign
    value = getWrapper(value);
    wrapper[typeProperty] = value[typeProperty];
    wrapper[valueProperty] = value[valueProperty];
  }

  static getRandomWord() {
    return faker.lorem.word();
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
    if (this.sample) {
      return this.sample;
    }

    const {
      getSegments,
    } = helpers;

    const keysFilter = k => getSegments({ original: k }).length === 1;
    const sample = this.unwrapObject({ wrapper: this.data, keysFilter });

    this.sample = sample;

    return sample;
  }

  unwrapObject({ wrapper, keysFilter }) {
    const {
      valueProperty, typeProperty, pathProperty,
    } = PathResolver;

    let keys = Object.keys(wrapper[valueProperty]).filter(k => k !== typeProperty);

    if (wrapper !== this.data && !keys.length) {
      throw new Error(`Path '${wrapper[pathProperty]}' is redundant and should be removed`);
    }

    if (keysFilter) {
      keys = keys.filter(keysFilter);
    }

    const o = {};

    keys.forEach((k) => {
      o[k] = this.getWrappedValue(wrapper[valueProperty][k]);
    });

    return o;
  }

  getWrappedValue(wrapper) {
    const {
      typeProperty, valueProperty, pathProperty,
      objectType, arrayType, getRandomWord, literalType,
      mapType,
    } = PathResolver;

    switch (wrapper[typeProperty]) {
      case objectType:
      case mapType:
        return this.unwrapObject({ wrapper });
      case arrayType:
        return wrapper[valueProperty].map(this.getWrappedValue, this);
      case literalType:
      default:
        if (wrapper[valueProperty] === '[]') {
          throw new Error(`Path '${wrapper[pathProperty]}' is redundant and should be removed`);
        }
        return getRandomWord();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  finalize() {
  }
}

module.exports = PathResolver;
