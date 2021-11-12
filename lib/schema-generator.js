
const assert = require('assert');
const fs = require('fs');

const { getAlias } = require('./utils');
const { findDuplicatesInArray, toCanonicalPath } = require('../src/assets/js/client-utils');
class SchemaGenerator {

  static nameProperty = '@name';

  static typeProperty = '@type';

  static pathProperty = '@path';

  static valueProperty = '@value';

  static literalType = 'Literal';

  static arrayType = 'Array';

  static objectType = 'Object';

  static mapType = 'Map';

  static componentRefType = 'componentRef';

  static getClassName({ key }) {
    return getAlias(key);
  }

  static visitConfigObject(obj, prefix, visitor) {
    Object.keys(obj).forEach(key => {
      if (key.startsWith(prefix)) {
        assert(key.startsWith(`${prefix}.`, ''));
        visitor(key.replace(`${prefix}.`, ''));
      }
    });
  }

  static verifyScalarDefinition({ config, path }) {
    const { typeProperty } = SchemaGenerator;

    const keys = Object.keys(config.scalars[path]);
    if (!keys[typeProperty]) {
      throw Error(`Incorrect signature at config.scalars['${path}']`);
    }
  }

  static verifyCollectionDefinition({ config, path }) {
    const keys = Object.keys(config.collections[path]);
    if (!["minLength", "singularType"].every(i => keys.includes(i))) {
      throw Error(`Incorrect signature at config.collections['${path}']`);
    }
  }

  static pruneConfig({ config, resolver, data, sharedTypes }) {

    const { typeProperty, valueProperty } = SchemaGenerator;

    // maxIndex: Object.keys(sharedTypes).length - 1
    // Object.keys(config.sharedTypeNames).forEach();


    fs.writeFileSync(resolver.getConfigPath(), JSON.stringify(config, null, 2));
  }

  static removeSharedType({ config, sharedTypeName, sharedTypeKey }) {

    const { visitConfigObject } = SchemaGenerator;

    delete config.sharedTypeNames[sharedTypeKey]

    visitConfigObject(config.scalars, sharedTypeName, (subPath) => {
      delete config.scalars[`${sharedTypeName}.${subPath}`]
    });

    visitConfigObject(config.collections, sharedTypeName, (subPath) => {
      delete config.collections[`${sharedTypeName}.${subPath}`]
    });
  }

  static verifySharedTypeSignature({ config, sharedTypeName, sharedTypeKey, path }) {

    const { visitConfigObject, removeSharedType } = SchemaGenerator;

    let isValid = true;

    visitConfigObject(config.scalars, sharedTypeName, (subPath) => {
      if (!config.scalars[`${path}.${subPath}`]) {
        isValid = false;
      }
    });

    if (!isValid) {
      return removeSharedType({ config, sharedTypeName, sharedTypeKey });
    }

    visitConfigObject(config.collections, sharedTypeName, (subPath) => {
      if (!config.collections[`${path}.${subPath}`]) {
        isValid = false;
      }
    });

    if (!isValid) {
      return removeSharedType({ config, sharedTypeName, sharedTypeKey });
    }
  }

  static verifySharedTypeNames(sharedTypeNames) {

    const { getSharedTypePrefix } = resolver.constructor;

    // Verify that the keys are valid
    Object.keys(sharedTypeNames).forEach(key => {
      if (!key.match(RegExp(`^${getSharedTypePrefix()}[0-9]+$`))) {
        throw Error(`Unknown key: ${key} specified in config.sharedTypeNames`);
      }
    });

    // Verify that the values are unique
    if (findDuplicatesInArray(Object.values(sharedTypeNames)).length) {
      throw Error(`Duplicate value found in config.sharedTypeNames`);
    }
  }

  static hydrateTypes({ data }) {
    const {
      pathProperty, valueProperty, typeProperty,
      objectType, mapType, arrayType, visitor
    } = SchemaGenerator;

    const visitor = ({ wrapper, fn }) => {
      switch (wrapper[typeProperty]) {
        case mapType:
          visitor(
            wrapper[valueProperty][
            Object.keys(wrapper[valueProperty])
              .filter(p => p != typeProperty)[0]
            ]
          );
          break;
        case arrayType:
          visitor(
            wrapper[valueProperty][0]
          );
          break;
        case objectType:
          if (!fn(wrapper)) {
            Object.keys(wrapper[valueProperty])
              .filter(p => p != pathProperty)
              .forEach(p => {
                visitor(wrapper[valueProperty][p])
              })
          }
          break;
      }
    }

    const types = [];

    visitor({
      wrapper: data,
      fn: (wrapper) => {
        const path = wrapper[pathProperty];
        const schemaString = JSON.stringify(wrapper[valueProperty]);
        let found = false;
        for (const type of types) {
          if (type.schemaString == schemaString) {
            type.paths.push(path);
            found = true;
            break;
          }
        }
        if (!found) {
          types.push({ paths: [path], schemaString });
        }
        return found;
      }
    });

    return types;
  }

  static mergeTypes({ data, config, resolver }) {

    const {
      typeProperty, literalType, hydrateTypes, verifySharedTypeSignature,
      verifySharedTypeNames, visitConfigObject
    } = SchemaGenerator;

    const {
      getSharedTypePrefix, defaultCollectionSize, getDefaultCollectionTypeName
    } = resolver.constructor;

    const sharedTypeNames = config.sharedTypeNames || (config.sharedTypeNames = {});

    // Ensure that config.sharedTypeNames is properly defined
    // Note that validation needs to happen early to ensure that
    // shared type names are correct
    verifySharedTypeNames(sharedTypeNames);

    const sharedTypes = {}

    hydrateTypes({ data })
      // We are only interested in types are are used by more than one path
      .filter(({ paths }) => paths.length > 1)
      .forEach(({ schemaString, paths }) => {

        const sharedTypeKey = `${getSharedTypePrefix()}${Object.keys(sharedTypes).length}`;

        const sharedTypeName = sharedTypeKey;

        // Determine SharedTypeName
        if (sharedTypeNames[sharedTypeName]) {
          sharedTypeName = sharedTypeNames[sharedTypeName];

          assert(typeof sharedTypeName == 'string');
        } else {
          sharedTypeNames[sharedTypeName] = sharedTypeName;
        }

        verifySharedTypeSignature({
          config, sharedTypeName, sharedTypeKey, path: paths[0]
        });

        sharedTypes[sharedTypeName] = {
          key: sharedTypeKey
        };

        // Prepare scalar entries for sharedType
        const scalars = sharedTypes[sharedTypeName].scalars = {};

        visitConfigObject(config.scalars, paths[0], (subPath) => {

          const pruneScalarTypes = (subPath) => {
            paths
              .map(p => `${p}.${subPath}`)
              .forEach(p => delete config.scalars[p][typeProperty]);
          }
          const { [typeProperty]: type } =
            config.scalars[
            `${sharedTypeName}.${subPath}`
            ] || { [typeProperty]: literalType };

          scalars[subPath] = {
            [typeProperty]: type
          };

          pruneScalarTypes(subPath);
        });

        // Prepare collection entries for sharedType
        const collections = sharedTypes[sharedTypeName].collections = {};

        visitConfigObject(config.collections, paths[0], (subPath) => {

          const pruneCollections = (subPath) => {
            paths
              .map(p => `${p}.${subPath}`)
              .forEach(p => delete config.collections[p]);
          }

          collections[subPath] = config.collections[
            `${sharedTypeName}.${subPath}`
          ] || {
            minLength: defaultCollectionSize,
            singularType: getDefaultCollectionTypeName(`${paths[0]}.${subPath}`)
          };

          pruneCollections(subPath);
        });
      });

    return sharedTypes;
  }

  static verifyConfig({ config }) {
    const {
      verifyScalarDefinition, verifyCollectionDefinition,
    } = SchemaGenerator;

    // Verify scalar and collection definitions

    Object.keys(config.scalars).forEach(path => {
      verifyScalarDefinition({ config, path });
    })

    Object.keys(config.collections).forEach(path => {
      verifyCollectionDefinition({ config, path });
    });
  }

  static createSchema({ data, preprocessor, config }) {

    const { verifyConfig, unwrapObject, mergeTypes, pruneConfig
    } = SchemaGenerator;

    verifyConfig({ config });

    const { className, resolver } = preprocessor;

    const componentTypes = {};
    const enumTypes = {};

    const rootSchema = {
      $schema: 'http://json-schema.org/draft-06/schema#',
      $ref: `#/definitions/${className}`,
      definitions: {},
    };

    pruneConfig({
      config, data, resolver,
      sharedTypes: config.enableTypeMerging ? mergeTypes({ data, config, resolver }) : {} 
    });

    unwrapObject({
      rootSchema, className, wrapper: data, config, root: true,
      componentTypes, enumTypes
    });

    return {
      schema: rootSchema,
      componentTypes, enumTypes
    };
  }

  static getSchemaObject({ required = [], className }) {
    return {
      type: 'object',
      additionalProperties: false,
      required,
      title: className,
      properties: {},
    };
  }

  static unwrapObject({
    rootSchema, className, wrapper, config, root = false,
    componentTypes, enumTypes
  }) {
    const {
      pathProperty, valueProperty, typeProperty,
      getClassName, getWrappedValue, getSchemaObject, getSchemaDefinition,
    } = SchemaGenerator;

    const keys = Object.keys(wrapper[valueProperty]).filter(k => k !== typeProperty);

    if (getSchemaDefinition(rootSchema, className)) {
      throw new Error(`Duplicate class definition - ${className}`);
    }

    const schema = getSchemaObject({ required: keys, className });

    rootSchema.definitions[className] = schema;

    if (
      root
      && keys.filter(k => k === 'id').length) {
      throw new Error(`Property 'id' is not allowed for class: ${className}`);
    }

    keys.forEach((key) => {

      // Todo: 
      // If multiple fields in this object have an array-based enum
      // that contain exactly the same items, mandate them to use an
      // enum reference. This is important because quicktype can
      // apply heuristics that is non-determiinstic

      const v = getWrappedValue({
        rootSchema,
        className: getClassName({ key }),
        wrapper: wrapper[valueProperty][key],
        config,
        path: wrapper[valueProperty][key][pathProperty],
        componentTypes, enumTypes
      });

      schema.properties[key] = v;

      if (v.$ref) {
        const typeName = v.$ref.replace('#/definitions/', '');

        if (rootSchema.definitions[typeName].isComponent) {
          (componentTypes[className] || (componentTypes[className] = []))
            .push(typeName);
        }

        if (rootSchema.definitions[typeName].isEnumRef) {
          (enumTypes[className] || (enumTypes[className] = []))
            .push(typeName);
        }
      }
    });

    return `#/definitions/${className}`;
  }

  static getSchemaDefinition(rootSchema, className) {
    // Todo:
    // Make this case insensitive - because this can cause an issue
    // when skipping refs. For example, in the java factory we call
    // .toLowerCase() when check if a class name is a ref
    return rootSchema.definitions[className]
  }

  static getLiteralValue({ type }) {
    switch (type) {
      case 'Boolean': return true;
      case 'Number': return 0;
      case 'String': default: return '';
    }
  }

  static getSupportedLiteralTypes() {
    return [
      'Boolean', 'Number', 'String'
    ];
  }

  static getWrappedValue({
    rootSchema, className, wrapper, config, path, componentTypes, enumTypes
  }) {
    const {
      nameProperty, typeProperty, valueProperty, pathProperty,
      objectType, arrayType, literalType, mapType, componentRefType,
      getLiteralValue, unwrapObject, getWrappedValue, getSchemaObject,
      getClassName, getSchemaDefinition, getSupportedLiteralTypes
    } = SchemaGenerator;

    switch (wrapper[typeProperty]) {
      case componentRefType:
        className = wrapper[nameProperty];

        if (!rootSchema.definitions[className]) {
          rootSchema.definitions[className] = {
            ...getSchemaObject({ className }),
            isComponent: true,
          };
        }

        return {
          [pathProperty]: path,
          $ref: `#/definitions/${className}`,
        };

      case mapType:

        const mapKeys = Object.keys(wrapper[valueProperty]);
        const newMapWrapper = wrapper[valueProperty][
          mapKeys[0]
        ];

        const mapSingularClassName = (() => {
          switch (newMapWrapper[typeProperty]) {
            case objectType:
              return getClassName({
                key: config.collections[wrapper[pathProperty]].singularType
              });
            default: return null;
          }
        })();

        return {
          [pathProperty]: path,
          type: 'object',
          additionalProperties: getWrappedValue({
            rootSchema,
            className: mapSingularClassName,
            wrapper: newMapWrapper,
            config,
            path: `${path}.$_`,
            componentTypes, enumTypes
          }),
        };

      case objectType:

        return {
          [pathProperty]: path,
          $ref: unwrapObject({
            rootSchema,
            className,
            wrapper,
            config,
            componentTypes, enumTypes
          }),
        };
      case arrayType:

        const newArrayWrapper = wrapper[valueProperty][0];

        const arraySingularClassName = (() => {
          switch (newArrayWrapper[typeProperty]) {
            case objectType:
              return getClassName({
                key: config.collections[wrapper[pathProperty]].singularType
              });
            default: return null;
          }
        })();

        return {
          [pathProperty]: path,
          type: 'array',
          items: getWrappedValue({
            rootSchema,
            className: arraySingularClassName,
            wrapper: newArrayWrapper,
            config,
            path: `${path}_$`,
            componentTypes, enumTypes
          }),
        };
      case literalType:
        assert(wrapper[valueProperty] !== '[]');
      default:

        const { allowed, type } = wrapper[pathProperty] ?
          config.scalars[wrapper[pathProperty]]
          : {};

        if (type && !getSupportedLiteralTypes().includes(type)) {
          throw Error(`[${path}] Unknown type ${type} defined in config.scalars`);
        }

        if (allowed && allowed.length) {

          const isEnumRef = typeof allowed == 'string';

          if (isEnumRef) {

            className = getClassName({ key: allowed });
            const schema = getSchemaDefinition(rootSchema, className);

            if (!schema) {
              rootSchema.definitions[className] = {
                ...getSchemaObject({ className }),
                originalName: allowed,
                isEnumRef: true,
              };
            } else if (!schema.isEnumRef) {
              throw new Error(`Duplicate class definition - ${className}`);
            }

            return {
              [pathProperty]: path,
              $ref: `#/definitions/${className}`,
            };

          } else {

            // Since, this will create a top-level class, we need to verify that
            // there are no other definitions with the same name.
            if (getSchemaDefinition(rootSchema, className)) {
              throw new Error(`Duplicate class definition - ${className}`);
            }

            // Also, place className in rootSchema.definitions, so that className
            // as registered as "in use". Later on, it will be excluded in the 
            // language factory
            rootSchema.definitions[className] = {
              ...getSchemaObject({ className }),
              isEnumRef: true
            };

            return {
              [pathProperty]: path,
              enum: allowed
            };
          }

        } else {
          return {
            [pathProperty]: path,
            type: getLiteralValue({
              type,
            }).constructor.name.toLowerCase(),
          };
        }
    }
  }
}

module.exports = SchemaGenerator;
