
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
const clientUtils = require('../src/assets/js/client-utils');
const SchemaError = require('./schema-error');

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

  static staticRandomWord = PathResolver.getRandomWord();

  static mapDefaultKey = `$_${PathResolver.getRandomWord()}`;

  static typeConfigProperty = 'type';

  static allowedConfigProperty = 'allowed';

  static singularTypeConfigProperty = 'singularType';

  static minLengthConfigProperty = 'minLength';

  static keyTypeConfigProperty = 'keyType';

  static defaultLiteralType = 'String';

  static configFileName = 'config.json';


  static defaultSampleCount = 5;

  constructor({ preprocessor }) {
    const { getWrapper } = PathResolver;

    this.preprocessor = preprocessor;

    this.data = getWrapper({});

    // ??? Todo: Remove, likely not used
    this.schemas = {};

    this.enums = this.loadEnums();
    this.config = this.loadConfig();

    this.processing = true;
  }

  throwError(msg, stmt) {
    const { className } = this.preprocessor;
    throw new SchemaError(`${className ? `[${className}] ` : ''}${msg}`);
  }

  loadEnums() {

    const path = pathLib.join(process.cwd(), 'src', 'components', 'enums.json');
    let enums = {};

    if (fs.existsSync(path)) {
      const data = fs.readFileSync(path, 'utf8');
      enums = JSON.parse(data);
    }

    return enums;
  }

  static getEmptyConfigObject() {
    const { defaultSampleCount } = PathResolver;

    return {
      enableTypeMerging: false, collections: {}, scalars: {}, escapeDynamicHtml: false,
      sample: { count: defaultSampleCount, nullifyRandomly: [], nullify: [] },
      loadAfterCompile: true, hookAccessRate: 3, invokeSyntheticMethodsOnCompile: false,
      inferCollections: false
    }
  }

  loadConfig0(path) {
    const { getEmptyConfigObject } = PathResolver;
    const configs = this.configs || (this.configs = {});

    let config = configs[path];

    if (!config) {
      if (fs.existsSync(path)) {
        const data = fs.readFileSync(path, 'utf8');
        try {
          config = JSON.parse(data);
        } catch (e) {
          this.throwError(`[${this.preprocessor.assetId}] ${e.message}`);
        }
      } else {
        config = getEmptyConfigObject();
      };
      configs[path] = config;
    }

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

        if (!value.allowed) {
          this.throwError(`Unknown enumName "${variableName}" specified in config.scalars["${key}"]`);
        }

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
    return path
      .replace(/_\$/g, '[0]')
      .replace(/(?<=\.)\$_(?=(\.|$|\[))/g, mapDefaultKey);
  }

  storeConfig() {
    this.unsubstituteEnums(this.config);

    fs.writeFileSync(
      this.getConfigPath(),
      JSON.stringify(this.config, null, 2),
    );
  }

  getConfigPath() {
    const { getConfigPath } = PathResolver;
    return getConfigPath(this.preprocessor.srcDir);
  }

  static getConfigPath(srcDir) {
    const { configFileName } = PathResolver;

    const path = pathLib
      .join(srcDir, configFileName);
    return path;
  }

  getParents() {
    return this.preprocessor.metadata.parents;
  }

  resolvePathFromParent(canonicalPath) {
    const { typeProperty, objectType, arrayType, mapType, literalType } = PathResolver;

    for (const parent of this.getParents()) {

      const { srcDir, scalars } = this.preprocessor.getNonNullConfig(parent);
      const srcConfig = this.loadConfig0(pathLib.join(srcDir, 'config.json'));

      const keys = Object.keys(scalars);

      const anyKeyStartsWith = (prefix) => {
        for (let k of keys) {
          if (k.startsWith(prefix)) {
            return true;
          }
        }
        return false;
      };

      const toRootProperty = (k) => {
        return k.split('.')[0].replace(/_\$$/g, '');
      }

      let canonicalPath0 = canonicalPath;
      let isLengthProperty = false;

      if (canonicalPath0.endsWith('.length')) {
        isLengthProperty = true;
        canonicalPath0 = utils.update(canonicalPath0, '.length', '', true)
      }

      const ensureNotLengthProperty = (type) => {
        if (isLengthProperty) {
          this.throwError(`"${canonicalPath0}" is a "${type}" and should not be accessed like an array (i.e. ${canonicalPath0}.length)`);
        }
      }

      switch (true) {
        case keys.includes(canonicalPath0):
          ensureNotLengthProperty(literalType);
          return { ...scalars[canonicalPath0], srcConfig };

        case anyKeyStartsWith(`${canonicalPath0}.`):
          ensureNotLengthProperty(objectType);
          return { [typeProperty]: objectType, srcConfig };

        case anyKeyStartsWith(`${canonicalPath0}_$`):
          if (isLengthProperty) {
            return {
              [typeProperty]: literalType, valueOverride: 1,
            }
          }
          return {
            [typeProperty]: arrayType, srcConfig
          };

        case anyKeyStartsWith(`${canonicalPath0}.$_`):
          ensureNotLengthProperty(mapType);
          return { [typeProperty]: mapType, srcConfig };

        default:
          if ([...new Set(keys.map(toRootProperty))].includes(toRootProperty(canonicalPath0))) {
            this.throwError(`Could not find path "${canonicalPath}" on parent "${parent}"`);
          }
      }
    }

    return null;
  }

  getPathInfo(fqPath) {
    return this.data[fqPath] ?
      this.data[fqPath] :
      this.resolvePathFromParent(clientUtils.toCanonicalPath(fqPath));
  }

  resolve({ path, create = true, stmt }) {
    return this.resolve0({ path, create });
  }

  resolve0({ path, create = true }) {

    assert(this.processing);

    const {
      emptyString, literalType, arrayType, mapType, typeProperty, nameProperty, componentRefType,
      objectType, valueProperty, pathProperty, mapDefaultKey, staticRandomWord, toCanonical,
      getValue, getWrapper,
    } = PathResolver;

    if (path === emptyString) {
      return this.data;
    }

    const arr = path.split('%');
    const fqPath = arr[0];

    const fqPathArr = fqPath.split('.');

    if (fqPathArr.at(-1).startsWith('@')) {
      // Data variable
      return staticRandomWord;
    }

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

    c:
    if (resolvedFromParent) {
      // This path exists on the parent

      const { [typeProperty]: type0, [nameProperty]: name, valueOverride, srcConfig } = resolvedFromParent;

      if (![
        type0,
        // literalType is a transitive type
        literalType
      ].includes(type)) {
        this.throwError(`${canonicalPath} is a ${type0} and cannot be resolved as a ${type}`);
      }

      if (
        type == componentRefType &&
        nameProperty != name &&
        this.preprocessor.getChildClasses(name, true).includes(nameQualifier)
      ) {
        // components are allowed to override inherited componentRef properties with a suitable sub-type
        const { metadata } = this.preprocessor;
        const overridenProperties = metadata.overridenProperties || (metadata.overridenProperties = []);

        overridenProperties.push(canonicalPath);

        break c;
      }

      if (valueOverride !== undefined) {
        return valueOverride;
      }

      const wrapper = {
        [pathProperty]: canonicalPath,
        [typeProperty]: type0,
        [nameProperty]: name,
      };

      wrapper[valueProperty] = (() => {
        switch (type0) {
          case literalType:
            return emptyString;
          case componentRefType:
            return {
              [typeProperty]: type0
            };
          case mapType:
            return {
              [typeProperty]: type0,
              [mapDefaultKey]: getWrapper(emptyString)
            };
          case objectType:
            return {};
          case arrayType:
            return [getWrapper(emptyString)];
          default:
            this.throwError(`Unknown type: ${type0}`);
        }
      })();

      const v = this.getWrappedValue(wrapper, srcConfig);
      return toCanonical(v);
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

        // TODO What is this???, review
        assert(value === Object(value));

        if (value !== Object(value)) {

          // Since <fqPath> is a Literal, and we are trying to
          // access it like a collection, automatically update it
          // to a collection. This is needed & especially important
          // for nested collections

          value = getValue({ type });

          // update <fqPath> value from literal, to an array/map
          this.updateValue({ original: fqPath, value });

          const canonicalPath = global.clientUtils.toCanonicalPath(fqPath);

          this.initCollectionConfig(canonicalPath, type)

        } else {

          if (wrapper[typeProperty] != type) {
            this.throwError(`"${canonicalPath}" is of type "${wrapper[typeProperty]}" and cannot be resolved as type "${type}"`);
          }

          if (!wrapper[nameProperty]) {

            // This happens if a collection member is either accessed from the template outside
            // an #each block or via the dynamic resolver proxy
            wrapper[nameProperty] = nameQualifier;
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
      objectType, mapType, nameProperty, singularTypeConfigProperty, mapDefaultKey, getWrapper, getValue,
      createArray, toCanonical, toNumber, getSingularTypeName0, getPathRegex,
    } = PathResolver;

    const { inferCollections = true, inferStringLength = false } = this.config;

    const fqPathArr = fqPath.split('.');

    let original = emptyString;

    let retOverride;

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < fqPathArr.length; i++) {
      const segments = global.clientUtils.getSegments({
        original: fqPathArr[i],
      });

      // eslint-disable-next-line no-labels
      loop:
      // eslint-disable-next-line no-plusplus
      for (let j = 0; j < segments.length; j++) {
        let segment = segments[j];

        const parent = original;
        const canonicalParent = global.clientUtils.toCanonicalPath(parent);

        const parentWrapper = parent.length ? this.data[parent] : this.data;

        if (parentWrapper[typeProperty] === componentRefType) {
          const arr = parent.split('.');
          const alias = arr[arr.length - 1];
          this.throwError(`Component reference: ${alias} cannot have a sub path`);
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
              this.throwError(`${original} is an ${existingValue.constructor.name} not ${newValue.constructor.name}`);

            default:
              // In this case, newValue is either an object or array and
              // the existingValue is a literal, hence we can proceed to update the existing value
              break;
          }
        }

        const ensureLastSegment = () => {
          if (original != fqPath) {
            this.throwError(`Unknown Path "${original}"`);
          }
        }

        const ensureLiteralType = () => {
          if (type != literalType) {
            this.throwError(`Expected "${original}" to have a targetType of "${literalType}" instead of ${type}`);
          }
        }

        let putValue = true;
        let valueOverride;

        let newArray = false;
        let originals = [original];

        switch (true) {
          case inferCollections && segment === 'size' && fqPathArr.length >= 2:
            ensureLiteralType();
            ensureLastSegment();

            putValue = false;

            // Return 1 to indicate collection length
            retOverride = 1;

            // eslint-disable-next-line default-case
            switch (parentWrapper[typeProperty]) {
              case literalType:
                // update parent value from literal, to map
                this.updateValue({
                  original: parent,
                  value: getValue({ type: mapType })
                });
                this.initCollectionConfig(parent, mapType)
                break;

              case objectType:
                this.throwError(`${parent || "ROOT"} is an object, and cannot be accessed like a map`);

              case mapType:
                break;

              case arrayType:
                this.throwError(`${parent} is an array, and cannot be accessed like an object`);
            }
            break;

          case inferCollections && segment === 'length' && fqPathArr.length >= 2:
            ensureLiteralType();
            ensureLastSegment();

            // Assume we are accessing index 0. 
            // Note: since we are modifying the segment, we also need to modify several other variables
            segment = `[0]`;
            original = original.replace('.length', segment);
            fqPath = original;
            originals[0] = original;


            // Return 1 to indicate collection length
            retOverride = 1;

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

            switch (true) {
              case parentType == literalType:
                this.initCollectionConfig(canonicalParent, arrayType);

                // update parent value to an array
                const arr = createArray({
                  length: toNumber({ segment }) + 1,
                });

                this.updateValue({
                  original: parent,
                  value: arr,
                });

                addOriginals(arr.length);

                break;

              case parentType == objectType:
                this.throwError(`${parent} is an object, and cannot be accessed like an array`);

              case parentType == mapType:
                this.throwError(`${parent} is a map, and cannot be accessed like an array`);

              case parentType == arrayType:

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
                      this.throwError(`${parent} is an array of objects, and cannot be accessed like an array of literals`);
                    case mapType:
                      this.throwError(`${parent} is an array of maps, and cannot be accessed like an array of literals`);
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
                break;
              default:
                this.throwError(`Unknown type: ${parentType}`);
            }

            break;

          default:

            // eslint-disable-next-line default-case
            switch (parentWrapper[typeProperty]) {
              case literalType:
                const k = original.replace(parent, emptyString).replace(/^\./g, '');
                const canonicalParent = global.clientUtils.toCanonicalPath(parent);

                const getCollParent = path => {
                  return (
                    // Array
                    path.endsWith('_$') ||
                    // Map
                    path.endsWith('.$_')
                  ) ?
                    path
                      // Array
                      .replace(/_\$$/g, '')
                      // Map
                      .replace(/\.\$_$/g, '') :
                    null;
                }

                if (k == mapDefaultKey) {

                  // update parent value from literal, to map
                  this.updateValue({ original: parent, value: getValue({ type: mapType }) });
                  this.initCollectionConfig(canonicalParent, mapType);

                  const collParent = getCollParent(canonicalParent);

                  if (collParent) {
                    delete this.config.collections[collParent][singularTypeConfigProperty];
                  }

                } else if (inferStringLength && k == 'length') {

                  putValue = false;
                  // represent string length as 1
                  retOverride = 1;
                } else {

                  // update parent value from literal, to object
                  this.updateValue({ original: parent, value: {} });

                  const collParent = getCollParent(canonicalParent);

                  if (collParent) {
                    assert(!!this.config.collections[collParent]);

                    this.config.collections[collParent][singularTypeConfigProperty] =
                      this.config.collections[collParent][singularTypeConfigProperty] ||
                      getSingularTypeName0(canonicalParent);
                  }
                }

                break;

              case objectType:
                break;

              case mapType:
                (() => {
                  const k = original.replace(parent, emptyString).replace(/^\./g, '');
                  assert(k == segment)

                  if (parentWrapper[valueProperty][k] === undefined) {
                    this.throwError(`Unknown property: ${k}. ${parent} is a map, and cannot be accessed like an object`);
                  }
                })();
                break;

              case arrayType:
                this.throwError(`${parent} is an array, and cannot be accessed like an object`);
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

    if (name && wrapper && !wrapper[nameProperty]) {
      wrapper[nameProperty] = name;
    }

    const ret = retOverride ? retOverride : this.getRawValue({ original });

    return ret;
  }

  initCollectionConfig(path, type) {
    if (!this.config.collections[path]) {
      this.initCollectionConfig0(path, type);
    }
  }

  static getDefaultCollectionConfig(type) {
    const {
      mapType, minLengthConfigProperty, keyTypeConfigProperty, defaultCollectionSize
    } = PathResolver;
    const opts = {
      [minLengthConfigProperty]: defaultCollectionSize,
    };
    if (type == mapType) {
      opts[keyTypeConfigProperty] = 'String';
    }
    return opts;
  }

  initCollectionConfig0(path, type) {
    const { getDefaultCollectionConfig } = PathResolver;
    assert(!this.config.collections[path], `Collection config for ${path} already exists`)

    this.config.collections[path] = getDefaultCollectionConfig(type);
  }

  static getSingularTypeName0(canonicalPath) {
    const { getAlias } = PathResolver;

    const typeName = utils.peek(canonicalPath.replace(/[(\.\$_)|(_\$)]+$/g, '').split('.'));
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
      this.data[`${original}.${mapDefaultKey}`] = e;
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

  getCurrentSampleIndex() {
    return this.currentSampleIndex;
  }

  finalize() {

    const { defaultSampleCount } = PathResolver;
    const { count: sampleCount = defaultSampleCount } = this.config.sample || {};

    this.processing = false;

    this.samples = [];

    for (let i = 0; i < sampleCount; i++) {
      this.currentSampleIndex = i;

      this.samples.push(
        this.unwrapObject({
          wrapper: utils.deepClone(this.data),
          root: true
        })
      )
    }

    this.currentSampleIndex = -1;

    this.storeConfig();

    return { data: this.data, config: this.config }
  }

  getCollections() {
    const {
      typeProperty, valueProperty, arrayType, mapType, minLengthConfigProperty,
    } = PathResolver;

    const o = {};

    Object.entries(this.data)
      .filter(
        ([k, v]) => {
          return ![typeProperty, valueProperty].includes(k) &&
            [arrayType, mapType].includes(v[typeProperty]);
        }
      )
      .forEach(([k, v]) => {
        const canonicalPath = clientUtils.toCanonicalPath(k);
        const { [minLengthConfigProperty]: minLength } = this.config.collections[canonicalPath];

        o[canonicalPath] = {
          [typeProperty]: v[typeProperty],
          [minLengthConfigProperty]: minLength,
        };
      });

    return o;
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
        const { loadable = true } = this.config.scalars[canonicalPath];

        o[canonicalPath] = {
          [typeProperty]: v[typeProperty],
          [nameProperty]: v[nameProperty],
        };

        if (v[typeProperty] == componentRefType) {
          o[canonicalPath].config = { loadable };
        }
      });

    return o;
  }

  static getSharedTypePrefix() {
    return 'SharedType';
  }

  static getReservedProperties() {
    const { typeProperty, nameProperty, pathProperty, valueProperty } = PathResolver;
    return [
      typeProperty, nameProperty, pathProperty, valueProperty,
      'toHtml',
      '$ref',
      'path',
      'path0',
      ...RootProxy.getReservedObjectKeys(),
      // Used in createDynamicResolver(...)
      'getPath',
      ...Object.keys(BaseRenderer.getDefaultConfig()),
    ]
  };

  static getReservedRootProperties() {
    const { getSharedTypePrefix } = PathResolver;
    return [
      // reserved getters in the generated component class
      'id', 'assetId', 'renderTree', 'jsDependencies', 'cssDependencies',
      // This is prefixed by default to sharedType names
      // It is used in the stringifySchema(...) function in SchemaGenerator.hydrateTypes(...) as a placeholder
      getSharedTypePrefix(),
      // These are reserved hash keys used during inline component rendering, some are synthetic some are not
      'ref', 'inlineComponent', 'path', 'useWeakRef',
      // These are reserved hash keys used for mustache statements
      'hook', 'hookPhase', 'hookOrder',
      ...RootProxy.getReservedRootObjectKeys(),
    ];
  }

  unwrapObject({ wrapper, root = false }) {
    const {
      valueProperty, pathProperty, typeProperty, getReservedRootProperties, getReservedProperties,
    } = PathResolver;

    const reservedProperties = getReservedProperties();
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
      if (customType) {
        // This map object is empty, likely because minLength was set to 0 in config.collections
      } else {
        this.throwError(`Path '${wrapper[pathProperty]}' is redundant and should be removed`);
      }
    }

    const o = {};

    keys.forEach((key) => {

      // Todo: Remove
      // assert(key.replace(/^\$_/g, '').match(/^\w+$/g));

      if (root) {
        if ([
          ...reservedProperties,
          ...getReservedRootProperties(),
          this.preprocessor.constructor.globalsBasePath,
        ].includes(key)) {
          this.throwError(`Property "${key}" cannot exist on the root object`);
        }
      } else if (reservedProperties.includes(key)) {
        this.throwError(`Object: '${wrapper[pathProperty]}' cannot contain the property: ${key}`);
      }

      o[key] = this.getWrappedValue(wrapper[valueProperty][key]);
    });

    if (this.processing && customType) {
      o[typeProperty] = customType;
    }

    return o;
  }

  static getCollectionConfig0(config, path) {
    return config.collections[path];
  }

  static getSingularTypeName(wrapper) {
    const {
      typeProperty, pathProperty, valueProperty, objectType, arrayType, mapType,
      getSingularTypeName0,
    } = PathResolver;

    assert([arrayType, mapType].includes(wrapper[typeProperty]));

    const childWrapper = Object.values(wrapper[valueProperty])[0];

    return childWrapper[typeProperty] == objectType ? getSingularTypeName0(wrapper[pathProperty]) : null;
  }

  getCollectionConfig(path, wrapper, config) {
    const {
      typeProperty, mapType, singularTypeConfigProperty, keyTypeConfigProperty, getSingularTypeName,
      getDefaultCollectionConfig, isCollectionType, getCollectionConfig0,
    } = PathResolver;

    assert(isCollectionType(wrapper));

    // Note: If !!singularTypeName, it implies that this is an object collection
    const singularTypeName = getSingularTypeName(wrapper);

    let collectionConfig = getCollectionConfig0(config, path);

    if (collectionConfig) {

      if (singularTypeName) {
        if (!collectionConfig[singularTypeConfigProperty]) {
          collectionConfig[singularTypeConfigProperty] = singularTypeName;
        }
      } else if (collectionConfig[singularTypeConfigProperty]) {
        delete collectionConfig[singularTypeConfigProperty];
      }

      if (collectionConfig[keyTypeConfigProperty] && wrapper[typeProperty] != mapType) {
        delete collectionConfig[keyTypeConfigProperty];
      }

    } else {
      collectionConfig = getDefaultCollectionConfig(wrapper[typeProperty]);

      if (singularTypeName) {
        collectionConfig[singularTypeConfigProperty] = singularTypeName;
      }
    }

    if (wrapper[typeProperty] == mapType) {
      // If this is a map, we need to validate the collectionConfig because it contains properties such as
      // "keyType" and "defaultKeys"

      this.getMapKeys(path, collectionConfig);
    }

    return collectionConfig;
  }

  static getLiteralTypes() {
    return ['string', 'number', 'boolean'];
  }

  getMapKeys(path, collectionConfig) {
    const {
      minLengthConfigProperty, keyTypeConfigProperty, getRandomWord, getLiteralTypes,
    } = PathResolver;

    const {
      [minLengthConfigProperty]: minLength, [keyTypeConfigProperty]: keyType = 'String', defaultKeys = [],
    } = collectionConfig;

    let keys = [...new Set(defaultKeys)];

    const literalTypes = getLiteralTypes();

    let enumValues;

    if (!literalTypes.includes(keyType.toLowerCase())) {
      enumValues = this.getSharedEnum(keyType);

      if (!enumValues) {
        this.throwError(`Unknown keyType "${keyType}" was specified for map "${path}"`);
      }
    };

    // If keyType is a shared enum, minLength should be <= enum length
    if (enumValues && minLength > enumValues.length) {
      this.throwError(
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
        this.throwError(
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
    const { typeConfigProperty, allowedConfigProperty, getRandomWord } = PathResolver;

    const scalarConfig = config.scalars[path];
    const hasDefault = !!scalarConfig.defaults;

    let {
      [typeConfigProperty]: type, [allowedConfigProperty]: allowed = [], defaultValue, defaults = [], min, max,
    } = scalarConfig;

    // Resolve references, if applicable
    if (type && type.constructor.name == 'Object') {
      type = config.scalars[type.$ref][typeConfigProperty];
    }
    if (allowed && allowed.constructor.name == 'Object') {
      allowed = config.scalars[allowed.$ref][allowedConfigProperty];
    }

    if (!type) {
      this.throwError(`[${path}] Scalar config must contain a type`);
    }

    if (type.toLowerCase() != 'string' && (defaults.length || allowed.length)) {
      this.throwError(
        `[${path}] Scalar config cannot contain "defaults" or "allowed" since type is not a string`
      );
    }

    if (allowed.length && defaults.length &&
      defaults.filter(v => v !== null && v != 'undefined' && !allowed.includes(v)).length) {
      this.throwError(`[${path}] Unknown value in defaults: ${defaults}, allowed: ${allowed}`);
    }

    const checkDuplicates = (property) => {
      const arr = scalarConfig[property] || [];
      if (arr.length) {
        const duplicates = clientUtils.findDuplicatesInArray(arr);
        if (duplicates.length) {
          this.throwError(`[${path}] Duplicate(s) found in '${property}': ${JSON.stringify(duplicates)}`);
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

    const throwUnknownValue = (t, v) => {
      this.throwError(`[${path}] Unknown value ${JSON.stringify(v)} in config.scalars. Expected type "${t}"`);
    }

    switch (type.toLowerCase()) {

      case 'boolean':

        setDefaultValue({ defaults: [this.processing ? false : undefined] });

        if (typeof defaultValue != 'boolean' && defaultValue !== undefined) {
          throwUnknownValue('boolean', defaultValue);
        }

        return defaultValue;

      case 'number':

        const arr = [];

        if (min != undefined && max != undefined) {
          for (let i = min; i <= max; i++) {
            arr.push(i);
          }
        }

        setDefaultValue({ defaults: arr.length ? arr : [this.processing ? 1234 : undefined] });

        if (typeof defaultValue != 'number' && defaultValue !== undefined) {
          throwUnknownValue('number', defaultValue);
        }

        return defaultValue;

      case 'string':

        switch (true) {
          case defaultValue !== undefined:
            return defaultValue;
          case !hasDefault:
            return undefined;
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
            return getRandomWord(10);
        }

      default:

        if (this.getComponentClass(type)) {
          // Return null without throwing an error. Note that literal types are
          // transitive types, and in this case - it is likely that: In an inline
          // block, a partial statement (that renders a component) is wrapped in a 
          // conditional block. And since component import statements are not
          // processed within inline blocks, the conditional block's path will resolve
          // first to a literal. The first the template is compiled everything will be
          // fine. But the second, we will find ourselves in this particular block
          return null;
        }

        this.throwError(`[${path}] Unknown type: ${type}`);
    }
  }

  getComponentClass(className) {
    return this.preprocessor.getComponentClass(className);
  }

  static isScalarType(wrapper) {
    const { typeProperty, componentRefType, literalType } = PathResolver;
    return [componentRefType, literalType].includes(wrapper[typeProperty]);
  }

  static isCollectionType(wrapper) {
    const { typeProperty, arrayType, mapType } = PathResolver;
    return [arrayType, mapType].includes(wrapper[typeProperty]);
  }

  getDefaultScalarConfig(wrapper) {
    const {
      typeProperty, nameProperty, componentRefType, literalType, typeConfigProperty,
      defaultLiteralType
    } = PathResolver;

    switch (wrapper[typeProperty]) {
      case literalType:
        return {
          [typeConfigProperty]: defaultLiteralType,
        };
      case componentRefType:
        const className = wrapper[nameProperty];
        return className == BaseComponent.name ? {
          [typeConfigProperty]: componentRefType,
          isNull: false,
        }
          : {
            [typeConfigProperty]: className,
            isNull: this.preprocessor.className == className
          };
    }
  }

  isClientOnly(path, config = this.config) {
    const { scalars, collections } = config;
    const { clientOnly } = scalars[path] || collections[path] || {};
    return clientOnly;
  }

  getWrappedValue(wrapper, config = this.config) {
    const {
      typeProperty, nameProperty, valueProperty, pathProperty, objectType, arrayType, literalType,
      componentRefType, mapType, mapDefaultKey, typeConfigProperty, minLengthConfigProperty,
      defaultLiteralType, getRandomWord, getCollectionConfig0, getDefaultCollectionConfig,
    } = PathResolver;

    const path = wrapper[pathProperty];
    const { nullifyRandomly, nullify } = config.sample || {};

    if (!this.processing) {
      switch (true) {
        case nullifyRandomly && nullifyRandomly.includes(path):
          if (!!utils.getRandomInt(0, 1)) {
            return undefined;
          }
          break;
        case nullify && nullify.includes(path):
          return undefined;
      }
    }

    const scalarConfig = config.scalars[path];
    const collectionConfig = getCollectionConfig0(config, path) || getDefaultCollectionConfig(wrapper[typeProperty]);

    const { [minLengthConfigProperty]: minLength } = collectionConfig;

    assert(
      !scalarConfig || scalarConfig[typeConfigProperty],
      `A "type" property is required in config.scalars.${path}`
    );

    switch (wrapper[typeProperty]) {

      case componentRefType:

        let className = wrapper[nameProperty];

        if (!scalarConfig || scalarConfig[typeConfigProperty] == defaultLiteralType) {
          config.scalars[path] = this.getDefaultScalarConfig(wrapper);
        }

        let { [typeConfigProperty]: type, defaults, isNull, loadable = true } = config.scalars[path];

        if (type && type.constructor.name == 'Object') {

          // This is a reference to another scalar entry
          type = config.scalars[type.$ref][typeConfigProperty];
        }

        if (defaults && this.processing) {
          defaults = defaults.filter(d => !!d);
        }

        if (defaults && defaults.length) {
          className = defaults[
            utils.getRandomInt(0, defaults.length - 1)
          ]

          if (className && !this.getComponentClass(className)) {
            this.throwError(`Unknown component: '${className}' specified in config.scalars.${path}.defaults`);
          }
        }

        if (type != componentRefType) {

          if (!this.getComponentClass(type)) {
            this.throwError(`Unknown type "${type}" specified in config.scalars.${path}.${typeConfigProperty}`);
          }

          if (type != className && !this.getComponentClass(className).prototype instanceof this.getComponentClass(type)) {
            this.throwError(
              `Expected "${className}" to be an instance of "${type}" for path: ${path}. To fix, update config.scalars.${path} to "${className}"`
            );
          }

        } else if (wrapper[nameProperty] != BaseComponent.name) {
          this.throwError(
            `Expected "config.scalars.${path}.${typeConfigProperty}" to be "${wrapper[nameProperty]}" not "${componentRefType}"`
          );
        }

        if (loadable !== undefined && typeof loadable != 'boolean') {
          this.throwError(`Unknown value "${loadable}" specified in config.scalars.${path}.loadable`);
        }

        if (isNull && !this.processing) {
          className = null;
        }

        return className ? this.preprocessor.getSerializedComponent(path, className, wrapper[nameProperty], loadable) : null;

      case objectType:
        return this.unwrapObject({ wrapper });

      case mapType:

        if (!this.processing) {

          const mapObject = wrapper[valueProperty];

          const mapKeys = Object.keys(mapObject).filter(k => k !== typeProperty);

          if (!mapKeys.length) {
            this.throwError(`Map: "${path}" is empty`);
          }

          assert(mapKeys.length == 1 && mapKeys[0] == mapDefaultKey);
          assert(minLength !== undefined);

          const keys = this.getMapKeys(path, collectionConfig);

          keys.forEach(k => {
            // Map elements share the same object reference, so we need to do a deep clone, so that
            // each element has it's own object reference and samples can be generated independently
            mapObject[k] = utils.deepClone(
              mapObject[mapKeys[0]]
            );
          });

          delete mapObject[mapKeys[0]]
        }

        return this.unwrapObject({ wrapper });

      case arrayType:

        assert(minLength !== undefined);

        const arr = wrapper[valueProperty];

        if (!arr.length) {
          if (!this.processing) {
            // This will happen if x.length is called in the template but x is actually
            // never iterated
            this.throwError(`Array: "${path}" is empty`);
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

        return newArray.map(e => this.getWrappedValue(e))
          .filter(v => this.processing ? true : v !== undefined);

      case literalType:
      default:
        if (wrapper[valueProperty] === '[]') {

          if (!this.processing) {
            this.throwError(`Path ${path} is redundant and should be removed`)
          }

          return wrapper[valueProperty];
        }

        if (path) {

          if (!scalarConfig) {
            config.scalars[path] = this.getDefaultScalarConfig(wrapper);
          }

          return this.getLiteralValue(path, config);

        } else {
          // This is a map default key
          return getRandomWord();
        }
    }
  }

  visitWrapper(wrapper, fn) {
    const {
      typeProperty, valueProperty, objectType, arrayType, mapType, mapDefaultKey
    } = PathResolver;

    fn(wrapper);

    switch (wrapper[typeProperty]) {
      case mapType:
        this.visitWrapper(
          wrapper[valueProperty][mapDefaultKey],
          fn,
        );
        break;
      case arrayType:
        this.visitWrapper(
          wrapper[valueProperty][0], fn
        );
        break;
      case objectType:
        Object.values(wrapper[valueProperty])
          .forEach(v => this.visitWrapper(v, fn))
        break;
    }
  }

  createDynamicResolver({ path, target }) {
    const {
      typeProperty, valueProperty, pathProperty, objectType, arrayType, componentRefType, literalType,
      mapDefaultKey, toRealPath,
    } = PathResolver;

    const _this = this;

    const literal = target !== Object(target);

    const getPathProperty = 'getPath';

    const getFqPath = (path, obj, prop) => {
      const isIndex = global.clientUtils.isNumber(prop);

      // resolver[0] is not valid
      assert(path !== '' || !isIndex);

      if (obj.constructor.name === 'Object' && !literal && isIndex) {
        _this.throwError(`Object: "${path}" cannot be accessed like an array`);
      }

      if (obj instanceof Array && !isIndex && prop !== 'length') {
        _this.throwError(`Array: "${path}" cannot be accessed like an object`);
      }

      let r = `${path}${isIndex ? `[${prop}]` : `${path.length ? '.' : ''}${prop}`}`;

      if (!clientUtils.validatePath(r)) {
        _this.throwError(`Invalid path "${r}`);
      } else {
        r = toRealPath(r);
      }

      return r;
    };

    return new Proxy(literal ? {} : target, {

      set(obj, prop, value) {

        const { data } = _this;

        const setterPath = typeof value[getPathProperty] == 'function' ? value[getPathProperty]() : null;
        let setterSchema = setterPath ? data[setterPath] : null;

        const fqPath = getFqPath(path, obj, prop);

        if (!setterSchema) {
          // ignore set operation
          return true;
        }

        if (data[fqPath]) {
          _this.throwError(`Cannot re-assign existing typings for "${fqPath}"`);
        }

        if (!_this.config.enableTypeMerging) {
          _this.throwError(`TypeMerging needs to be enabled, i.e. set config.enableTypeMerging to true`);
        }

        setterSchema = utils.deepClone(setterSchema);

        // Attempt to resolve to ensure <fqPath>
        _this.resolve({ path: fqPath });

        // Transform wrapper paths
        _this.visitWrapper(setterSchema, (wrapper) => {
          const { collections, scalars, sample: { nullifyRandomly = [] } } = _this.config;

          const setterPathC = clientUtils.toCanonicalPath(setterPath);
          const fqPathC = clientUtils.toCanonicalPath(fqPath);

          const prev = wrapper[pathProperty];
          const current = wrapper[pathProperty].replace(setterPathC, fqPathC);

          assert(wrapper[pathProperty].startsWith(setterPathC));

          wrapper[pathProperty] = current;

          data[toRealPath(current)] = wrapper;


          if (collections[prev]) {
            collections[current] = collections[prev];
          }

          if (scalars[prev]) {
            scalars[current] = scalars[prev];
          }

          if (nullifyRandomly.includes(prev) && !nullifyRandomly.includes(current)) {
            nullifyRandomly.push(current);
          }
        });


        if (path) {
          const parentSchema = data[path];

          switch (parentSchema[typeProperty]) {
            case arrayType:
              parentSchema[valueProperty][0] = setterSchema;
              break;
            case objectType:
              parentSchema[valueProperty][prop] = setterSchema;
              break;
            default:
              // Note: type cannot be 
              // 1. literalType: because we called this.resolve(...) above, hence <parentSchema> now has a subpath and cannot be of type literal
              // 2. mapType: because setting map childPaths is not supported
              _this.throwError(`Unknown type "${parentSchema[typeProperty]}"`);
              break;
          }

        } else {
          // Add to root level
          data[valueProperty][fqPath] = setterSchema;
        }

        return true;
      },

      get(obj, prop) {

        switch (true) {
          case prop === Symbol.toPrimitive:
            return () => target;

          case !!Object.getPrototypeOf(obj)[prop]:
            return obj[prop];

          case prop === getPathProperty:
            return () => path;

          default:

            if (!prop) {
              throw Error(`Expected a non-empty object property but got: ${path}[""]`);
            }

            if (prop.toLowerCase() == '@mapkey') {
              prop = mapDefaultKey;
            }

            if (prop.includes(".")) {
              throw Error(`Property "${path}.${prop}" is invalid`);
            }

            const fqPath = getFqPath(path, obj, prop);
            const value = _this.resolve({ path: fqPath });

            return value instanceof BaseComponent ? value : _this.createDynamicResolver({ path: fqPath, target: value });
        }
      },
    });
  }
}

module.exports = PathResolver;
