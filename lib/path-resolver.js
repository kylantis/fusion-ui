/* eslint-disable class-methods-use-this */
/* eslint-disable no-case-declarations */

const faker = require('faker');
const helpers = require('./preprocessor-helpers');

class PathResolver {
  static emptyObject = {};

  static emptyString = '';

  static hasIndex = /\[[0-9]+\]/g;

  static typeProperty = '@type';

  static valueProperty = 'value';

  static literalType = 'Literal';

  static arrayType = 'Array';

  static objectType = 'Object';

  constructor({ pluginName, componentName, path }) {
    const { getWrapper } = PathResolver;

    this.pluginName = pluginName;
    this.componentName = componentName;
    this.path = path;

    this.fqPaths = {};
    this.data = getWrapper({});
  }

  resolve(path) {
    const arr = path.split('%');
    const fqPath = arr[0];

    if (arr.length === 1) {
      // Get existing value
      const original = this.fqPaths[fqPath];
      const value = this.getRawValue({ original });

      return value === '[]' ? [] : value;
    }

    const metaArray = arr[1].split('/');

    const types = metaArray[0].split(',');
    // eslint-disable-next-line no-unused-vars
    const scopeQualifier = metaArray[1];

    const value = this.addValue({
      fqPath, type: types[0],
    });

    // console.log(`${path.split('%')[0]} = ${JSON.stringify(value)}`);
    return value === '[]' ? [] : value;
  }

  addValue({ fqPath, type }) {
    const {
      hasIndex, typeProperty, valueProperty,
      emptyString, getWrapper, getValue,
      literalType, objectType,
      arrayType,
    } = PathResolver;
    const {
      getSegments,
    } = helpers;

    // console.log(`# ${fqPath}`);
    const fqPathArr = fqPath.split('.');

    let original = emptyString;

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < fqPathArr.length; i++) {
      const segments = getSegments({
        original: fqPathArr[i],
        zeroIndexes: true,
      });
      // eslint-disable-next-line prefer-template

      // eslint-disable-next-line no-plusplus
      for (let j = 0; j < segments.length; j++) {
        const segment = segments[j];

        const parent = original;

        const parentWrapper = parent.length ? this.data[parent] : this.data;
        // console.log(parentWrapper);

        original += `${i === 0 || j > 0 ? emptyString : '.'}${segment}`;

        // console.log(`-> ${original}, (parent=${parent})`);
        
        if (this.data[original]) {
          // eslint-disable-next-line no-continue
          continue;
        }

        let putValue = true;

        switch (true) {
          case segment === 'length':
            putValue = false;
          // eslint-disable-next-line no-fallthrough
          case !!segment.match(hasIndex):

            switch (parentWrapper[typeProperty]) {
              case literalType:
                // update parent value from literal, to an array
                this.updateValue({ original: parent, value: [getWrapper(emptyString)] });
                break;

              case objectType:
                throw new Error(`${parent} is an object, and cannot be accessed like an array`);

              case arrayType:

                if (segment !== 'length') {
                  // We expect the preceeding array to be an array of array

                  // eslint-disable-next-line default-case
                  switch (parentWrapper[valueProperty][0][typeProperty]) {
                    case literalType:
                      // update from array literal, to an array of array
                      this.updateValue({
                        original: parent,
                        value: [
                          getWrapper([getWrapper(emptyString)]),
                        ],
                      });
                      break;

                    case objectType:
                      throw new Error(`${parent} is an array of objects, and cannot be accessed like an array of arrays`);
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

              case arrayType:
                throw new Error(`${parent} is an array, and cannot be accessed like an object`);
            }

            break;
        }
        // console.log(JSON.stringify(parentWrapper));
        if (putValue) {
          this.putValue({
            parent,
            parentWrapper,
            original,
            value: getValue({ type }),
          });
        }
      }
    }

    this.fqPaths[fqPath] = original;
    return this.getRawValue({ original });
  }

  getRawValue({ original }) {
    const { valueProperty } = PathResolver;
    const value = this.data[original] ? this.data[original][valueProperty] : null;
    return value instanceof Array ? [value[0][valueProperty]] : value;
  }

  static getValue({ type }) {
    const {
      emptyString, objectType,
      arrayType,
    } = PathResolver;

    switch (type) {
      case objectType:
        return {};
      case arrayType:
        return '[]';
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

    const { valueProperty } = PathResolver;
    const key = `${parent.length ? '' : '.'}${original.replace(parent, emptyString)}`;
    // console.log(parentWrapper);
    // console.log(original);

    const cmd = `parentWrapper['${valueProperty}']${key} = this.data['${original}'] = getWrapper(value)`;
    // console.log(`parentWrapper['${valueProperty}']${key} = this.data['${original}'] = getWrapper(${JSON.stringify(value)})`);
    // eslint-disable-next-line no-eval
    eval(cmd);

    // console.log(this.data[valueProperty].people);
  }

  updateValue({ original, value }) {
    const { getWrapper, typeProperty, valueProperty } = PathResolver;
    const wrapper = this.data[original];
    // eslint-disable-next-line no-param-reassign
    value = getWrapper(value);
    wrapper.clear();
    wrapper[typeProperty] = value[typeProperty];
    wrapper[valueProperty] = value[valueProperty];
  }

  static getRandomWord() {
    return faker.lorem.words();
  }

  static getWrapper(value) {
    const { typeProperty, valueProperty, literalType } = PathResolver;

    const type = value !== Object(value) ? literalType : value.constructor.name;

    const o = {};
    o[typeProperty] = type;
    o[valueProperty] = value;

    return o;
  }

  getSample() {
    const { unwrapObject } = PathResolver;

    const {
      getSegments,
    } = helpers;

    const keysFilter = k => getSegments({ original: k }).length === 1;
    const sample = unwrapObject({ wrapper: this.data, keysFilter });

    // console.log(JSON.stringify(sample));

    return sample;
  }

  static unwrapObject({ wrapper, keysFilter }) {
    // console.log(`unwrapObject`);
    // console.log(wrapper);
    const { valueProperty, getWrappedValue } = PathResolver;

    let keys = Object.keys(wrapper[valueProperty]);

    if (keysFilter) {
      keys = keys.filter(keysFilter);
    }
    // console.log(keys);
    const o = {};

    keys.forEach((k) => {
      o[k] = getWrappedValue(wrapper[valueProperty][k]);
    });

    return o;
  }

  static getWrappedValue(wrapper) {
    // console.log(`getWrappedValue`);
    // console.log(wrapper.value.person);
    const {
      typeProperty, valueProperty,
      getWrappedValue, unwrapObject,
      objectType, arrayType, getRandomWord,
    } = PathResolver;

    switch (wrapper[typeProperty]) {
      case objectType:
        return unwrapObject({ wrapper });
      case arrayType:
        return wrapper[valueProperty].map(getWrappedValue);
      default:
        return getRandomWord();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  finalize() {
  }
}

module.exports = PathResolver;
