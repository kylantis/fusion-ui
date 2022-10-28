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
const utils = require('./utils');
const assert = require('assert');
const { findDuplicatesInArray } = require('../src/assets/js/client-utils');
const clientUtils = require('../src/assets/js/client-utils');
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

  static defaultCollectionSize = 10;

  static reservedProperties = [
    this.typeProperty, this.nameProperty, this.pathProperty, this.valueProperty,
    'toHtml', '$ref', 'path', 'path0'
  ];

  static reservedRootProperties = ['id', 'assetId', this.getSharedTypePrefix(), 'ref'];

  static mapDefaultKey = `$_${PathResolver.getRandomWord()}`;

  static typeConfigProperty = 'type';

  static singularTypeConfigProperty = 'singularType';

  static minLengthConfigProperty = 'minLength';

  static keyTypeConfigProperty = 'keyType';

  static defaultLiteralType = 'String';

  static sampleCount = 5;

  constructor({ preprocessor }) {
    const { getWrapper } = PathResolver;

    this.preprocessor = preprocessor;

    this.data = getWrapper({});
    this.schemas = {};

    this.enums = this.loadEnums();
    this.config = this.loadConfig();

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

  static getEmptyConfigObject() {
    return {
      enableTypeMerging: false, collections: {}, scalars: {},
      useCollectionLengthProperty: true, escapeDynamicHtml: false,
      sample: { nullifyRandomly: [] },
    }
  }

  loadConfig0(path) {
    const { getEmptyConfigObject } = PathResolver;
    let config;

    if (fs.existsSync(path)) {
      const data = fs.readFileSync(path, 'utf8');
      try {
        config = JSON.parse(data);
      } catch (e) {
        throw Error(`[${this.preprocessor.assetId}] ${e.message}`);
      }
    } else {
      config = getEmptyConfigObject();
    };

    // Substitute variables, if necessary
    this.substituteEnums(config);

    return config;
  }

  loadConfig() {
    return this.loadConfig0(
      this.getConfigPath()
    );
  }

  getSharedEnum(name) {
    const value = this.enums[name];
    if (value == undefined) {
      `Unknown enum: ${name}`
    }
    return value;
  }

  substituteEnums(config) {
    Object.entries(config.scalars).forEach(([key, value]) => {

      if (typeof value.allowed == 'string') {
        const variableName = value.allowed;
        value.allowed = this.getSharedEnum(variableName);

        Object.defineProperty(value.allowed, 'variableName', {
          value: variableName, enumerable: false
        });
      }
    });
  }

  unsubstituteEnums(config) {

    Object.entries(config.scalars).forEach(([key, value]) => {
      if (value.allowed && value.allowed.variableName) {
        value.allowed = value.allowed.variableName;
      }
    });
  }

  static toRealPath(path) {
    const { mapDefaultKey } = PathResolver;
    return path.replace(/_\$/g, '[0]').replace(/\$_/g, mapDefaultKey)
  }

  storeConfig() {
    this.unsubstituteEnums(this.config);

    fs.writeFileSync(
      this.getConfigPath(),
      JSON.stringify(this.config, null, 2),
    );
  }

  getConfigPath() {
    const path = pathLib
      .join(this.preprocessor.srcDir, 'config.json');
    return path;
  }

  getParentClass() {
    const { metadata, className } = this.preprocessor;
    const { parents: [parent] } = metadata.componentSources[className];

    return parent;
  }

  getParentConfig() {
    if (this.parentConfig) {
      return this.parentConfig;
    }

    const {
      metadata, constructor: { getComponentsSrcPath }
    } = this.preprocessor;
    const parentClass = this.getParentClass();

    assert(!!parentClass);

    const { dirName } = metadata.componentSources[parentClass.name];

    const path = pathLib.join(getComponentsSrcPath(), dirName, 'config.json');
    this.parentConfig = this.loadConfig0(path);

    return this.parentConfig;
  }

  resolvePathFromParent(canonicalPath) {
    const {
      typeProperty, objectType, arrayType, mapType,
    } = PathResolver;

    const { constructor: { getConfig } } = this.preprocessor;

    const parentClass = this.getParentClass();

    if (!parentClass) {
      // This component does not have any parent
      return null;
    }

    const parentConfig = getConfig(parentClass.name);

    if (!parentConfig) {
      // Could not find config for parent. Maybe initCompile() was just called by our preprocessor, and
      // we have not yet have the chance to compile parents
      return null;
    }

    const { scalars } = parentConfig;

    const keys = Object.keys(scalars);

    const anyKeyStartsWith = (prefix) => {
      for (let k of keys) {
        if (k.startsWith(prefix)) {
          return true;
        }
        return false;
      }
    };

    const toRootProperty = (k) => {
      return k.split('.')[0].replace(/_\$$/g, '');
    }

    switch (true) {

      case keys.includes(canonicalPath):
        return scalars[canonicalPath];

      case anyKeyStartsWith(`${canonicalPath}.`):
        return { [typeProperty]: objectType };

      case anyKeyStartsWith(`${canonicalPath}_$`):
        return { [typeProperty]: arrayType };

      case anyKeyStartsWith(`${canonicalPath}.$_`):
        return { [typeProperty]: mapType };

      default:
        if ([...new Set(keys.map(toRootProperty))].includes(toRootProperty(canonicalPath))) {
          throw Error(`Could not find path: ${canonicalPath} on parent: ${parentClass.name}`);
        }
    }

    return null;
  }

  getPathInfo(fqPath) {
    return this.data[fqPath] ?
      this.data[fqPath] :
      this.resolvePathFromParent(clientUtils.toCanonicalPath(fqPath));
  }

  resolve({ path, create = true }) {

    assert(this.processing);

    const {
      emptyString, literalType, arrayType, mapType, typeProperty, nameProperty,
      componentRefType, objectType, valueProperty, pathProperty, mapDefaultKey,
      toCanonical, getRandomWord, getValue, getWrapper,
    } = PathResolver;

    const { getDataVariables } = this.preprocessor.constructor;
    if (path === emptyString) {
      return this.data;
    }

    const arr = path.split('%');
    const fqPath = arr[0];

    let type = literalType;
    let nameQualifier;

    if (arr.length > 1) {
      const metaArray = arr[1].split('/');

      type = metaArray[0];
      // eslint-disable-next-line prefer-destructuring
      nameQualifier = metaArray[1];
    }

    const canonicalPath = clientUtils.toCanonicalPath(fqPath)

    const resolvedFromParent = this.resolvePathFromParent(canonicalPath);

    if (resolvedFromParent) {

      const { [typeProperty]: existingType } = resolvedFromParent;

      // This path exists on the parent

      if (![
        existingType,
        // literalType is a transitive type
        literalType
      ].includes(type)) {
        throw Error(`${canonicalPath} is a ${existingType} and cannot be resolved as a ${type}`);
      }

      const parentConfig = this.getParentConfig();

      const wrapper = {
        ...resolvedFromParent,
        [pathProperty]: canonicalPath,
      };

      wrapper[valueProperty] = (() => {
        switch (existingType) {
          case literalType:
            return emptyString;
          case componentRefType:
            return {
              [typeProperty]: existingType
            };
          case mapType:
            return {
              [typeProperty]: existingType,
              [mapDefaultKey]: getWrapper(emptyString)
            };
          case objectType:
            return {};
          case arrayType:
            return [getWrapper(emptyString)];
          default:
            throw Error(`Unknown type: ${existingType}`);
        }
      })();

      const v = this.getWrappedValue(wrapper, parentConfig);
      return toCanonical(v);
    }

    const globalVariablePrefix = RootCtxRenderer.getGlobalsBaseExecPath();

    switch (true) {
      
      // Data variable
      case !!fqPath.match(/\[\'@\w+\'\]$/g):
        assert(
          getDataVariables()
            .map(v => `['${v}']`)
            .includes(fqPath.match(/\[\'@\w+\'\]$/g)[0])
        )
        return getRandomWord();

      // Global variable
      case fqPath.startsWith(globalVariablePrefix):
        const globalVariableName = fqPath.replace(`${globalVariablePrefix}.`).split('.')[0]
        const globalVariableType = this.preprocessor.component.getGlobalVariableTypes()[globalVariableName];

        assert(globalVariableType);

        return this.preprocessor.getSampleValueForType(globalVariableType);
    }

    const wrapper = this.data[fqPath];

    if (
      wrapper &&
      // literalType is a transitive type, from which the type can be 
      // transformed to other type(s) via addValue(...) 
      (wrapper[typeProperty] != literalType || type == literalType)
    ) {

      // Get existing value
      let value = this.getRawValue({ original: fqPath });

      if ([arrayType, mapType].includes(type)) {

        assert(value === Object(value));

        if (value !== Object(value)) {

          // Since <fqPath> is a Literal, and we are trying to
          // access it like a collection, automatically update it
          // to a collection. This is needed especially important
          // for nested collections

          value = getValue({ type });

          // update <fqPath> value from literal, to an array/map
          this.updateValue({ original: fqPath, value });

          const canonicalPath = global.clientUtils.toCanonicalPath(fqPath);

          this.initCollectionConfig(canonicalPath, type)

        } else {

          // Scope qualifiers are required for all #each blocks
          assert(!!nameQualifier);

          if (wrapper[typeProperty] != type) {
            throw Error(`${canonicalPath} is a ${wrapper[typeProperty]} and cannot be resolved as a ${type}`);
          }

          if (!wrapper[nameProperty]) {

            // There are two possible scenarios where wrapper will have no name property
            // First, an array was initially created by accessing it's index or by getting length, e.g.
            // arr[0] or arr.length. Second, a map was initially created by getting size, i.e. map.size

            wrapper[nameProperty] = nameQualifier;

            if (type == mapType) {

              delete wrapper[valueProperty][typeProperty];

              // Add <mapDefaultKey> to map
              this.putValue({
                parentWrapper: wrapper,
                parent: fqPath,
                original: `${fqPath}.${mapDefaultKey}`,
                value: getValue({ type: literalType }),
              })

              wrapper[valueProperty][typeProperty] = mapType;
            }
          }
        }
      }

      return toCanonical(value);
    }

    if (!create) {
      return null;
    }

    const value = this.addValue({
      fqPath,
      type,
      name: nameQualifier,
    });

    return toCanonical(value);
  }

  addValue({ fqPath, type, name }) {
    const {
      hasIndex, typeProperty, valueProperty, emptyString, componentRefType, arrayType, literalType, 
      objectType, mapType, nameProperty, singularTypeConfigProperty, getWrapper, getValue, createArray,
      toCanonical,  toNumber, getDefaultCollectionTypeName,
      getPathRegex,
    } = PathResolver;

    const fqPathArr = fqPath.split('.');

    let original = emptyString;

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < fqPathArr.length; i++) {
      const segments = global.clientUtils.getSegments({
        original: fqPathArr[i],
      });

      // eslint-disable-next-line no-labels
      loop:
      // eslint-disable-next-line no-plusplus
      for (let j = 0; j < segments.length; j++) {
        const segment = segments[j];

        const parent = original;
        const canonicalParent = global.clientUtils.toCanonicalPath(parent);

        const parentWrapper = parent.length ? this.data[parent] : this.data;

        if (parentWrapper[typeProperty] === componentRefType) {
          const arr = parent.split('.');
          const alias = arr[arr.length - 1];
          throw Error(`Component reference: ${alias} cannot have a sub path`);
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
              throw Error(`${original} is an ${existingValue.constructor.name} not ${newValue.constructor.name} - ${fqPath}`);

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
          case segment === 'size' && !!this.config.useCollectionLengthProperty:
            assert(type == literalType)
            putValue = false;

            // eslint-disable-next-line default-case
            switch (parentWrapper[typeProperty]) {
              case literalType:
                // update parent value from literal, to map
                this.updateValue({
                  original: parent, value: {
                    [typeProperty]: mapType,
                  }
                });
                this.initCollectionConfig(parent, mapType)
                break;

              case objectType:
                throw Error(`${parent} is an object, and cannot be accessed like a map - ${fqPath}`);

              case mapType:
                break;

              case arrayType:
                throw Error(`${parent} is an array, and cannot be accessed like an object - ${fqPath}`);
            }
            break;

          case segment === 'length' && !!this.config.useCollectionLengthProperty:
            assert(type == literalType)
            putValue = false;

          // eslint-disable-next-line no-fallthrough
          case !!segment.match(hasIndex):

            const addOriginals = (length) => {

              const getIndexSegment = (str) => {
                const arr = str.split('.');

                const segments = global.clientUtils.getSegments({
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
                p = p.replace(RegExp(`\\[${i}\\]$`), '');

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

              const p = RegExp(`^${getPathRegex(`${parent}[0]`)
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

            const parentType = parentWrapper[typeProperty];
            const parentValue = parentWrapper[valueProperty];

            switch (true) {
              case parentType == literalType:
                this.initCollectionConfig(canonicalParent, arrayType);

              // A previous call to .length resulted in an empty array
              case (parentType == arrayType && !parentValue.length):

                // update parent value to an array
                const arr = createArray({
                  // Note: if segment === 'length', toNumber(...) will return NaN. hence
                  // createArray(...) will return an empty array
                  length: toNumber({ segment }) + 1,
                });

                this.updateValue({
                  original: parent,
                  value: arr,
                });

                addOriginals(arr.length);

                break;

              case parentType == objectType:
                throw Error(`${parent} is an object, and cannot be accessed like an array - ${fqPath}`);

              case parentType == mapType:
                throw Error(`${parent} is a map, and cannot be accessed like an array - ${fqPath}`);

              case parentType == arrayType:
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
                        throw Error(`${parent} is an array of objects, and cannot be accessed like an array of literals - ${fqPath}`);
                      case mapType:
                        throw Error(`${parent} is an array of maps, and cannot be accessed like an array of literals - ${fqPath}`);
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
                throw Error(`Unknown type: ${parentType}`);
            }

            break;

          default:

            // eslint-disable-next-line default-case
            switch (parentWrapper[typeProperty]) {
              case literalType:
                // update parent value from literal, to an object
                this.updateValue({ original: parent, value: {} });

                const canonicalParent = global.clientUtils.toCanonicalPath(parent);

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

                  this.config.collections[path][singularTypeConfigProperty] =
                    this.config.collections[path][singularTypeConfigProperty] ||
                    getDefaultCollectionTypeName(
                      canonicalParent,
                    );
                }

                break;

              case objectType:
                break;

              case mapType:
                const k = original.replace(parent, emptyString).replace(/^\./g, '');
                assert(k == segment)

                if (parentWrapper[valueProperty][k] === undefined) {
                  throw Error(`Unknown property: ${k}. ${parent} is a map, and cannot be accessed like an object - ${fqPath}`);
                }

                break;

              case arrayType:
                throw Error(`${parent} is an array, and cannot be accessed like an object - ${fqPath}`);
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
              const canonicalPath = global.clientUtils.toCanonicalPath(original);
              this.initCollectionConfig(canonicalPath, mapType)
            }
          });
        }
      }
    }

    assert(fqPath === original);

    const wrapper = this.data[original];

    if (name && !wrapper[nameProperty]) {
      wrapper[nameProperty] = name;
    }

    return this.getRawValue({ original });
  }

  initCollectionConfig(path, type) {
    if (!this.config.collections[path]) {
      this.initCollectionConfig0(path, type);
    }
  }

  initCollectionConfig0(path, type) {
    const {
      minLengthConfigProperty, keyTypeConfigProperty, defaultCollectionSize, mapType
    } = PathResolver;

    assert(!this.config.collections[path], `Collection config for ${path} already exists`)

    const opts = {
      [minLengthConfigProperty]: defaultCollectionSize,
    };
    if (type == mapType) {
      opts[keyTypeConfigProperty] = 'String';
    }
    this.config.collections[path] = opts;
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
    return wrapper ?
      this.getWrappedValue(utils.deepClone(wrapper)) :
      null;
  }

  static toCanonical(value) {
    const {
      typeProperty, mapType, getRandomWord,
    } = PathResolver;
    switch (true) {
      case value === '[]':
        // Return an array, with a single literal in it.
        // It is important to note that the index resolver used at compile-time
        // defaults to 0. And if the block's program contains only
        // data variable lookups, we will have an exception, unless
        // we put at least one item in this array
        return [getRandomWord()];

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
      .replace(RegExp(`\\[[0-9+]\\]`, 'g'), '\\[[0-9+]\\]')
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
      getWrapper, emptyString, pathProperty, mapType, mapDefaultKey,
      typeProperty, valueProperty, getPathRegex,
    } = PathResolver;

    const parentPattern = RegExp(`^${getPathRegex(parent)}`);

    assert(original.match(parentPattern));

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

    const v = eval(`this.data["${original}"] = ${lhs}`);
    const canonicalPath = global.clientUtils.toCanonicalPath(original);

    v[pathProperty] = canonicalPath;

    if (v[typeProperty] == mapType) {
      const e = v[valueProperty][mapDefaultKey];

      e[pathProperty] = `${canonicalPath}.$_`
      this.data[`${canonicalPath}.${mapDefaultKey}`] = e;
    }
  }

  static toNumber({ segment }) {
    return Number(
      segment.replace('[', '').replace(']', ''),
    );
  }

  updateValue({ original, value }) {
    const {
      typeProperty, valueProperty, pathProperty, getWrapper,
    } = PathResolver;
    const wrapper = this.data[original];
    // eslint-disable-next-line no-param-reassign
    value = getWrapper(value);
    wrapper[typeProperty] = value[typeProperty];
    wrapper[valueProperty] = value[valueProperty];

    const path = global.clientUtils.toCanonicalPath(original);
    assert((!wrapper[pathProperty]) || wrapper[pathProperty] === path);

    wrapper[pathProperty] = path;
  }

  static getRandomWord(length = 10) {
    return randomstring.generate({
      length,
      charset: 'abcdefghijklmnopqrstuvwxyz',
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

  getSamples() {
    return utils.deepClone(this.samples);
  }

  finalize() {
    const { sampleCount } = PathResolver;
    this.processing = false;

    this.samples = [];

    for (let i = 0; i < sampleCount; i++) {
      this.samples.push(
        this.unwrapObject({
          wrapper: utils.deepClone(this.data),
          root: true
        })
      )
    }

    this.storeConfig();

    return { data: this.data, config: this.config }
  }

  getScalars() {
    const {
      typeProperty, valueProperty, literalType, componentRefType, nameProperty
    } = PathResolver;

    const o = {};

    Object.entries(this.data)
      .filter(
        ([k, v]) => {
          return ![typeProperty, valueProperty].includes(k) &&
            [literalType, componentRefType].includes(v[typeProperty]);
        }
      )
      .forEach(([k, v]) => {
        const canonicalPath = clientUtils.toCanonicalPath(k);

        o[canonicalPath] = {
          [typeProperty]: v[typeProperty],
          [nameProperty]: v[nameProperty]
        };
      });

    return o;
  }

  static getSharedTypePrefix() {
    return 'SharedType';
  }

  unwrapObject({ wrapper, root = false }) {
    const {
      valueProperty, pathProperty, typeProperty, mapType,
      reservedProperties, reservedRootProperties,
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

      throw Error(`Path '${wrapper[pathProperty]}' is redundant and should be removed`);
    }

    const o = {};

    keys.forEach((key) => {

      // Todo: Remove
      // assert(key.replace(/^\$_/g, '').match(/^\w+$/g));

      if (root) {
        if ([
          ...reservedProperties,
          ...reservedRootProperties,
          this.preprocessor.constructor.globalsBasePath,
        ].includes(key)) {
          throw Error(`Property: ${key} cannot exist on the root object`);
        }
      } else if (reservedProperties.includes(key)) {
        throw Error(`Object: '${wrapper[pathProperty]}' cannot contain the property: ${key}`);
      }

      o[key] = this.getWrappedValue(wrapper[valueProperty][key]);
    });

    if (customType) {
      o[typeProperty] = customType;
    }

    return o;
  }

  getMapKeys(path, keyType, minLength, defaultKeys) {
    const { getRandomWord } = PathResolver;

    let keys = [...new Set(defaultKeys)];

    const literalTypes = ['string', 'number', 'boolean'];

    let enumValues;

    if (!literalTypes.includes(keyType.toLowerCase())) {
      enumValues = this.getSharedEnum(keyType);

      if (!enumValues) {
        throw Error(`Unknown keyType "${keyType}" was specified for map: ${path}`);
      }
    };

    // If keyType is a shared enum, minLength should be <= enum length
    if (enumValues && minLength > enumValues.length) {
      throw Error(
        `Invalid length '${minLength}' was specified in [config.collections.${path}.minLength]. Max value allowed is '${enumValues.length}'`
      );
    }

    const isValidValue = (k) => {
      if (k == undefined) {
        return false;
      }
      switch (keyType.toLowerCase()) {
        case 'string': return typeof k == 'string';
        case 'number': return typeof k.constructor.name == 'Number';
        case 'boolean': return typeof k.constructor.name == 'Boolean';
        default:
          return enumValues.includes(k);
      }
    };

    // Ensure that keys have the correct type
    keys.forEach(k => {
      if (!isValidValue(k)) {
        throw Error(
          `Invalid key '${k}' was specified in [config.collections.${path}.defaultKeys]`
        );
      }
    });

    const enumValuesPool = enumValues ? enumValues.filter(k => !keys.includes(k)) : null;
    let enumValueIndex = 0;

    const getAnyValue = () => {
      switch (keyType.toLowerCase()) {
        case 'string': return getRandomWord();
        case 'number': return utils.getRandomInt(0, 100);
        case 'boolean': return [true, false][utils.getRandomInt(0, 1)];
        default:
          assert(enumValueIndex <= enumValuesPool.length - 1);
          const v = enumValuesPool[enumValueIndex];
          enumValueIndex++;
          return v;
      }
    };


    if (keys.length < minLength) {
      for (let i = keys.length; i < minLength; i++) {
        keys.push(getAnyValue());
      }
    } else {
      keys = keys.slice(0, minLength);
    }

    return keys;
  }

  getLiteralValue(path, config) {
    const { typeConfigProperty, toNumber } = PathResolver;

    const scalarConfig = config.scalars[path];
    const hasDefault = !!scalarConfig.defaults;

    let { [typeConfigProperty]: type, defaultValue, defaults = [], allowed = [] } = scalarConfig;

    if (type && type.constructor.name == 'Object') {

      // This is a reference to another scalar entry
      type = config.scalars[type.$ref][typeConfigProperty];
    }

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
      assert(!defaults.length && !allowed.length, `[${path}]: Incorrect signature: ${JSON.stringify(scalarConfig)}`);
    }

    if (allowed.length && defaults.length &&
      defaults.filter(v => v !== null && !allowed.includes(v)).length) {
      throw Error(`[${path}] Unknown value in defaults: ${defaults}, allowed: ${allowed}`);
    }

    const checkDuplicates = (property) => {
      const arr = scalarConfig[property] || [];
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
      if (defaultValue === undefined) {
        defaultValue = defaults[
          utils.getRandomInt(0, defaults.length - 1)
        ]
      }
    }

    const { getRandomWord } = PathResolver;

    switch (type) {

      case 'Boolean':
        // Default to false
        setDefaultValue({ defaults: [false] });
        assert(typeof defaultValue == 'boolean');
        return defaultValue;

      case 'Number':
        setDefaultValue({ defaults: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
        assert(typeof defaultValue == 'number');
        return defaultValue;

      case 'String':

        switch (true) {
          case !hasDefault:
            return null;
          case !!allowed.length:
            if (defaults.length) {
              return defaults[
                utils.getRandomInt(0, defaults.length - 1)
              ];
            } else {
              return allowed[
                utils.getRandomInt(0, allowed.length - 1)
              ];
            }
          case !!defaults.length:
            return defaults[
              utils.getRandomInt(0, defaults.length - 1)
            ];
          default:
            return getRandomWord(length);
        }

      default:

        if (this.preprocessor.getComponentClassNames().includes(type)) {
          // Return null without throwing an error. Note that literal types are
          // transitive types, and in this case - it is likely that: In an inline
          // block, a partial statement (that renders a component) is wrapped in a 
          // conditional block. And since component import statements are not
          // processed within inline blocks, the conditional block's path will resolve
          // first to a literal. The first the template is compiled everything will be
          // fine. But the second, we will find ourselves in this particular block
          return null;
        }

        throw Error(`[${path}] Unknown type: ${type}`);
    }
  }

  getComponent(className) {
    return this.preprocessor.getSerializedComponent(className);
  }

  getWrappedValue(wrapper, config = this.config) {
    const {
      typeProperty, nameProperty, valueProperty, pathProperty,
      objectType, arrayType, literalType, componentRefType,
      mapType, mapDefaultKey, typeConfigProperty, minLengthConfigProperty,
      defaultLiteralType, keyTypeConfigProperty, getRandomWord,
    } = PathResolver;

    const path = wrapper[pathProperty];
    const { nullifyRandomly } = config.sample || {};

    if (
      nullifyRandomly && nullifyRandomly.includes(path) &&
      // Only do this on sample generation
      !this.processing
    ) {
      const nullify = !!utils.getRandomInt(0, 1);
      if (nullify) {
        return null;
      }
    }

    const {
      [minLengthConfigProperty]: minLength,
      [keyTypeConfigProperty]: keyType = 'String',
      defaultKeys = [],
    } = config.collections[path] || {};
    const scalarConfig = config.scalars[path];

    switch (wrapper[typeProperty]) {

      case componentRefType:

        let className = wrapper[nameProperty];

        if (!scalarConfig || scalarConfig[typeConfigProperty] == defaultLiteralType) {
          config.scalars[path] =
            className == BaseComponent.name ? {
              [typeConfigProperty]: componentRefType
            }
              : {
                [typeConfigProperty]: className,
                isNull: this.preprocessor.className == className
              }
        }

        let { [typeConfigProperty]: type, defaults, isNull } = config.scalars[path];

        if (type && type.constructor.name == 'Object') {

          // This is a reference to another scalar entry
          type = config.scalars[type.$ref][typeConfigProperty];
        }

        if (className == BaseComponent.name) {

          assert(type == componentRefType, `Unknown type: ${type} for path: ${path}`)

          if (this.processing) {
            defaults = defaults.filter(d => !!d);
          }

          if (defaults && defaults.length) {
            className = defaults[
              utils.getRandomInt(0, defaults.length - 1)
            ]

            if (className && !global.components[className]) {
              throw Error(`Unknown component: '${className}' specified in defaults for path: ${path}`);
            }
          }

        } else {
          assert(
            type == className, 
            `Expected type "${className}" not "${type}" for path: ${path}. To fix, update config.scalars.${path} to "${className}"`
          )
          if (isNull && !this.processing) {
            className = null;
          }
        }

        return className ? this.getComponent(className) : null;

      case objectType:
        return this.unwrapObject({ wrapper });

      case mapType:

        if (!this.processing) {

          const mapObject = wrapper[valueProperty];

          const mapKeys = Object.keys(mapObject).filter(k => k !== typeProperty);

          if (!mapKeys.length) {
            throw Error(`Map: "${path}" is empty`);
          }

          assert(mapKeys.length == 1 && mapKeys[0] == mapDefaultKey);
          assert(minLength !== undefined);

          const keys = this.getMapKeys(path, keyType, minLength, defaultKeys);

          keys.forEach(k => {
            // Map elements share the same object reference, so we need to do a deep clone, so that
            // each element has it's own object reference and samples can be generated independently
            mapObject[k] = utils.deepClone(
              mapObject[mapKeys[0]]
            );
          });

          delete mapObject[mapKeys[0]]
        }

        return this.unwrapObject({ wrapper });;

      case arrayType:

        assert(minLength !== undefined);

        const arr = wrapper[valueProperty];

        if (!arr.length) {
          if (!this.processing) {
            // This will happen if x.length is called in the template but x is actually
            // never iterated
            throw Error(`Array: "${path}" is empty`);
          } else {
            return [];
          }
        }

        const len = this.processing ? (arr.length > minLength ? arr.length : minLength) : minLength;
        let newArray = [];

        for (let i = 0; i < len; i++) {
          newArray.push(arr[0]);
        }

        if (!this.processing) {
          // Array elements share the same object reference, so we need to do a deep clone, so that
          // each element has it's own object reference and samples can be generated independently
          newArray = newArray.map((e) => utils.deepClone(e));
        }

        return newArray.map(e => this.getWrappedValue(e));

      case literalType:
      default:
        if (wrapper[valueProperty] === '[]') {

          if (!this.processing) {
            throw Error(`Path ${path} is redundant and should be removed`)
          }

          return wrapper[valueProperty];
        }

        if (path) {

          if (!scalarConfig) {
            config.scalars[path] = {
              [typeConfigProperty]: defaultLiteralType,
              defaults: []
            };
          }

          return this.getLiteralValue(path, config);

        } else {
          // This is a map default key
          return getRandomWord();
        }
    }
  }
}

module.exports = PathResolver;
