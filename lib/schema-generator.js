
const assert = require('assert');
const fs = require('fs');

const utils = require('./utils');
const { findDuplicatesInArray, toCanonicalPath } = require('../src/assets/js/client-utils');
class SchemaGenerator {

  static nameProperty = '@name';

  static typeProperty = '@type';

  static typeConfigProperty = 'type';

  static pathProperty = '@path';

  static valueProperty = '@value';

  static literalType = 'Literal';

  static arrayType = 'Array';

  static objectType = 'Object';

  static mapType = 'Map';

  static componentRefType = 'componentRef';

  static minLengthProperty = 'minLength';

  static singularTypeConfigProperty = 'singularType';

  static getClassName(key) {
    return utils.getAlias(key);
  }

  static visitConfigObject(obj, prefix, visitor) {
    Object.keys(obj).forEach(key => {
      const p = `${prefix}.`;
      if (key.startsWith(p)) {
        visitor(key.replace(p, ''));
      }
    });
  }

  static pruneConfig({ config, resolver, data, sharedTypes, logger }) {

    const {
      mapType, arrayType, literalType, componentRefType, singularTypeConfigProperty,
      typeConfigProperty, getCanonicalPaths
    } = SchemaGenerator;
    const { getSharedTypePrefix } = resolver.constructor;

    const { sharedTypeNames = {}, collections, scalars } = config;

    // Prune config
    Object.keys(sharedTypeNames).forEach(key => {

      const index = parseInt(key.replace(getSharedTypePrefix(), ''), 10);

      if (index >= Object.keys(sharedTypes).length) {
        // sharedTypeNames entry has an invalid entry. We know by because the
        // index is out of the expected range. Remove this entry
        delete sharedTypeNames[key];
      }
    });

    const collectionPaths = getCanonicalPaths({ data, types: [mapType, arrayType] });
    const prunedCollections = [];

    Object.keys(collections)
      .filter(k => !collectionPaths.includes(k))
      .forEach(k => {
        prunedCollections.push(k);
      });

    const scalarPaths = getCanonicalPaths({ data, types: [literalType, componentRefType] });
    const prunedScalars = [];

    Object.keys(scalars)
      .filter(k =>
        !scalarPaths.includes(k)
      )
      .forEach(k => {
        prunedScalars.push(k);
      });


    // If any entry in <prunedCollections> or <prunedScalars> is referenced by a known
    // path, do not prune

    collectionPaths.forEach(p => {

      const v = collections[p];
      const singularType = v[singularTypeConfigProperty];

      assert(v);

      if (singularType && singularType.constructor.name == 'Object') {
        const ref = collections[singularType.$ref];

        if (!ref || !ref[singularTypeConfigProperty]) {
          throw Error(`[$${p}] Unknown singularType ref: ${singularType.$ref}`);
        }

        if (prunedCollections.includes(singularType.$ref)) {
          prunedCollections.splice(prunedCollections.indexOf(singularType.$ref), 1);
        }
      }
    });

    scalarPaths.forEach(p => {

      const v = scalars[p];
      const type = v[typeConfigProperty];

      assert(v && type);

      if (type.constructor.name == 'Object') {
        const ref = scalars[type.$ref];

        if (!ref || !ref[typeConfigProperty]) {
          throw Error(`[$${p}] Unknown type ref: ${type.$ref}`);
        }

        if (prunedScalars.includes(type.$ref)) {
          prunedScalars.splice(prunedScalars.indexOf(type.$ref), 1);
        }
      }
    });

    // Then, delete the pruned paths
    prunedScalars.forEach(p => delete scalars[p]);
    prunedCollections.forEach(p => delete collections[p]);

    // Save config file
    fs.writeFileSync(resolver.getConfigPath(), JSON.stringify(config, null, 2));
  }

  static getCanonicalPaths({ data, types = [] }) {
    const { typeProperty, valueProperty } = SchemaGenerator;

    return Object.keys(data)
      .filter(k => ![typeProperty, valueProperty].includes(k))
      .filter(k => types.length ? types.includes(data[k][typeProperty]) : true)
      .map(k => toCanonicalPath(k));
  }

  static verifySharedTypeNames({ sharedTypeNames, data, resolver }) {

    const { getSharedTypePrefix } = resolver.constructor;
    const canonicalPaths = SchemaGenerator.getCanonicalPaths({ data });

    const wordPattern = /^\w+$/g;

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

    Object.values(sharedTypeNames).forEach(value => {
      // Verify that this value is a word
      if (!value.match(wordPattern)) {
        throw Error(`sharedTypeName: ${value} should be a valid word`)
      }
      // Verify that this value is not a data path
      if (canonicalPaths.includes(value)) {
        throw Error(`sharedTypeName: ${value} should not be a data path`)
      }
    });
  }

  static hydrateTypes({ data, resolver }) {
    const {
      pathProperty, valueProperty, typeProperty,
      objectType, mapType, arrayType
    } = SchemaGenerator;

    const { getSharedTypePrefix } = resolver.constructor;

    const visitor = (wrapper, fn) => {
      switch (wrapper[typeProperty]) {
        case mapType:
          visitor(
            wrapper[valueProperty][
            Object.keys(wrapper[valueProperty])
              .filter(p => p != typeProperty)[0]
            ], fn
          );
          break;
        case arrayType:
          visitor(
            wrapper[valueProperty][0], fn
          );
          break;
        case objectType:
          if (!fn(wrapper)) {
            Object.keys(wrapper[valueProperty])
              .filter(p => p != pathProperty)
              .forEach(p => {
                visitor(wrapper[valueProperty][p], fn)
              })
          }
          break;
      }
    }

    const types = [];

    const stringifySchema = (path, value) => {
      return JSON.stringify(value, (key, val) => {
        if (val && val.constructor.name === 'Object' && val[pathProperty]) {
          return {
            ...val,
            [pathProperty]: val[pathProperty].replace(`${path}`, getSharedTypePrefix())
          }
        }
        return val;
      }, null);
    }

    visitor(
      data,
      (wrapper) => {
        const path = wrapper[pathProperty];
        const schemaString = stringifySchema(path, wrapper[valueProperty]);
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
    );

    return types;
  }

  static mergeTypes({ data, config, resolver, rootSchema, logger, opts }) {

    const {
      typeConfigProperty, typeProperty, valueProperty, objectType, pathProperty, singularTypeConfigProperty,
      hydrateTypes, verifySharedTypeNames, visitConfigObject, unwrapObject
    } = SchemaGenerator;

    const {
      getSharedTypePrefix, getDefaultCollectionTypeName, defaultLiteralType, toRealPath
    } = resolver.constructor;

    const sharedTypeNames = config.sharedTypeNames || (config.sharedTypeNames = {});

    // Ensure that config.sharedTypeNames is properly defined
    // Note that validation needs to happen early to ensure that
    // shared type names are correct
    verifySharedTypeNames({ sharedTypeNames, data, resolver });

    const sharedTypes = {}

    hydrateTypes({ data, resolver })
      // We are only interested in types that are used by more than one path
      .filter(({ paths }) => paths.length > 1)
      .forEach(({ paths, schemaString }) => {

        const sharedTypeKey = `${getSharedTypePrefix()}${Object.keys(sharedTypes).length}`;

        let sharedTypeName = sharedTypeKey;

        // Determine SharedTypeName
        if (sharedTypeNames[sharedTypeName]) {
          sharedTypeName = sharedTypeNames[sharedTypeName];

          assert(typeof sharedTypeName == 'string');
        } else {
          sharedTypeNames[sharedTypeName] = sharedTypeName;
        }

        sharedTypes[sharedTypeName] = {
          key: sharedTypeKey, paths
        };

        // Prepare scalar entries for sharedType
        const scalars = sharedTypes[sharedTypeName].scalars = {};

        visitConfigObject(config.scalars, paths[0], (subPath) => {

          /**
           * This updates the type from a string to an object that serves as a reference
           * to the 
           * @param {String} subPath 
           */
          const updateTypes = (subPath) => {
            paths
              .map(p => `${p}.${subPath}`)
              .forEach(p => config.scalars[p][typeConfigProperty] = {
                $ref: `${sharedTypeName}.${subPath}`
              });
          }

          const k = `${sharedTypeName}.${subPath}`;

          const { [typeConfigProperty]: type } =
            config.scalars[k] = config.scalars[k] || { [typeConfigProperty]: defaultLiteralType };

          scalars[subPath] = {
            [typeConfigProperty]: type
          };

          updateTypes(subPath);
        });

        // Prepare collection entries for sharedType
        const collections = sharedTypes[sharedTypeName].collections = {};

        visitConfigObject(config.collections, paths[0], (subPath) => {

          const updateSingularityTypes = (subPath) => {
            paths
              .map(p => `${p}.${subPath}`)
              .forEach(p => config.collections[p][[singularTypeConfigProperty]] = {
                $ref: `${sharedTypeName}.${subPath}`
              });
          }

          const k = `${sharedTypeName}.${subPath}`;

          collections[subPath] = config.collections[k] = config.collections[k] || {
            [singularTypeConfigProperty]: getDefaultCollectionTypeName(`${paths[0]}.${subPath}`)
          };

          updateSingularityTypes(subPath);
        });

        // Add SharedType to rootSchema

        const sharedTypeWrapper = {
          [typeProperty]: objectType,
          [valueProperty]: JSON.parse(schemaString, (key, val) => {
            if (val && val.constructor.name === 'Object' && val[pathProperty]) {
              val[pathProperty] = [
                val[pathProperty].replace(getSharedTypePrefix(), sharedTypeName),
                ...paths.map(p => val[pathProperty].replace(getSharedTypePrefix(), p))
              ];
            }
            return val;
          })
        }

        unwrapObject({
          rootSchema,
          className: sharedTypeName, shared: true,
          wrapper: sharedTypeWrapper, config, logger,
          ...opts,
        });

        // Update paths to reference sharedTypeName
        paths.map(toRealPath).forEach(k => {
          assert(!!data[k]);

          utils.clear(data[k]);

          data[k][pathProperty] = [sharedTypeName, ...paths];
          data[k].$ref = `#/definitions/${sharedTypeName}`;
        });

      });

    return sharedTypes;
  }

  static createSchema({ data, preprocessor, config }) {

    const { unwrapObject, mergeTypes, pruneConfig
    } = SchemaGenerator;

    SchemaGenerator.preprocessor = preprocessor;

    const { className, resolver, logger } = preprocessor;

    const componentTypes = {};
    const enumTypes = {};

    const rootSchema = {
      $schema: 'http://json-schema.org/draft-06/schema#',
      $ref: `#/definitions/${className}`,
      definitions: {},
    };

    const opts = { componentTypes, enumTypes };

    const sharedTypes = config.enableTypeMerging ?
      mergeTypes({
        data, config, resolver, rootSchema,
        logger, opts
      }) : {}

    unwrapObject({
      rootSchema, className, wrapper: data, config, root: true, logger,
      ...opts
    });

    pruneConfig({
      config, data, resolver, logger,
      sharedTypes
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
    rootSchema, className, wrapper, config, root = false, logger,
    shared = false, componentTypes, enumTypes
  }) {
    const {
      pathProperty, valueProperty, typeProperty,
      getClassName, getWrappedValue, getSchemaObject, getSchemaDefinition,
      processRef,
    } = SchemaGenerator;

    const value = wrapper[valueProperty];
    const keys = Object.keys(value)

      .filter(k => k !== typeProperty);

    if (getSchemaDefinition(rootSchema, className)) {
      throw Error(`Duplicate class definition - ${className}`);
    }

    const schema = getSchemaObject({ required: keys, className });

    if (shared) {
      schema.shared = true;
    }

    rootSchema.definitions[className] = schema;

    if (
      root
      && keys.filter(k => k === 'id').length) {
      // The 'id' property is reserved for the component id
      throw Error(`Property 'id' is not allowed for class: ${className}`);
    }

    keys.forEach((key) => {

      // Todo: 
      // If multiple fields in this object have an array-based enum
      // that contain exactly the same items, mandate them to use an
      // enum reference. This is important because quicktype can
      // apply heuristics that is non-determiinstic

      const v = value[key].$ref ? value[key] : getWrappedValue({
        rootSchema,
        className: getClassName(key),
        typeName: className,
        wrapper: wrapper[valueProperty][key],
        config, logger, shared,
        path: wrapper[valueProperty][key][pathProperty],
        componentTypes, enumTypes
      });

      schema.properties[key] = v;

      const { $ref } = v;

      if ($ref) {
        processRef({ $ref, rootSchema, componentTypes, enumTypes, className });
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

  static processRef({ $ref, rootSchema, componentTypes, enumTypes, className }) {
    const typeName = $ref.replace('#/definitions/', '');

    if (rootSchema.definitions[typeName].isComponent) {
      (componentTypes[className] || (componentTypes[className] = []))
        .push(typeName);
    }

    if (rootSchema.definitions[typeName].isEnumRef) {
      (enumTypes[className] || (enumTypes[className] = []))
        .push(typeName);
    }
  }

  static getWrappedValue({
    rootSchema, typeName, className, wrapper, config, path, shared, logger, componentTypes, enumTypes
  }) {
    const {
      nameProperty, typeProperty, typeConfigProperty, valueProperty, pathProperty,
      objectType, arrayType, literalType, mapType, componentRefType, singularTypeConfigProperty,
      getLiteralValue, unwrapObject, getWrappedValue, getSchemaObject, processRef,
      getClassName, getSchemaDefinition, getSupportedLiteralTypes
    } = SchemaGenerator;

    if (typeof path == 'string') {
      path = [path];
    }
    assert(path && !!path.length);

    const getSingularClassName = (wrapper) => {
      switch (wrapper[typeProperty]) {
        case objectType:
          let singularType = config.collections[path[0]][singularTypeConfigProperty];

          if (singularType.constructor.name == 'Object' && singularType.$ref) {
            // This is a reference to another scalar entry
            singularType = config.collections[singularType.$ref][singularTypeConfigProperty];
          }

          return getClassName(singularType);
        default: return null;
      }
    }

    switch (wrapper[typeProperty]) {
      case componentRefType:
        className = wrapper[nameProperty];

        if (!rootSchema.definitions[className]) {
          rootSchema.definitions[className] = {
            ...getSchemaObject({ className }),
            isComponent: true,
          };
        } else {
          // A definition exists with the same name. If the
          // existing definition is neither a component ref nor
          // the root schema definition, throw an error indicating
          // a duplicate class name

          const definition = rootSchema.definitions[className];

          if (
            !definition.isComponent &&
            SchemaGenerator.preprocessor.className !== className
          ) {
            throw Error(`Duplicate class definition - ${className}`);
          }
        }

        return {
          [pathProperty]: path,
          $ref: `#/definitions/${className}`,
        };

      case mapType:

        const mapChildWrapper = wrapper[valueProperty][
          Object.keys(wrapper[valueProperty])[0]
        ];

        return {
          [pathProperty]: path,
          type: 'object',
          additionalProperties: getWrappedValue({
            rootSchema,
            typeName,
            className: getSingularClassName(mapChildWrapper, wrapper),
            wrapper: mapChildWrapper,
            config, logger, shared,
            path: mapChildWrapper[pathProperty],
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
            config, shared,
            componentTypes, enumTypes
          }),
        };
      case arrayType:

        const arrayChildWrapper = wrapper[valueProperty][0];
        
        const items = getWrappedValue({
          rootSchema,
          typeName,
          className: getSingularClassName(arrayChildWrapper),
          wrapper: arrayChildWrapper,
          config, logger, shared,
          path: arrayChildWrapper[pathProperty],
          componentTypes, enumTypes
        });

        const { $ref } = items;

        if ($ref) {
          processRef({ $ref, rootSchema, componentTypes, enumTypes, className: typeName });
        }

        return {
          [pathProperty]: path,
          type: 'array',
          items,
        };
      case literalType:
        assert(wrapper[valueProperty] !== '[]');
      default:

        let { allowed, [typeConfigProperty]: type } = config.scalars[path[0]];

        if (type && type.constructor.name == 'Object') {

          // This is a reference to another scalar entry
          type = config.scalars[type.$ref][typeConfigProperty];
        }

        if (type && !getSupportedLiteralTypes().includes(type)) {
          throw Error(`[${path[0]}] Unknown type ${type} defined in config.scalars`);
        }

        if (allowed && allowed.length) {

          const isEnumRef = typeof allowed == 'string';

          if (isEnumRef) {

            className = getClassName(allowed);
            const schema = getSchemaDefinition(rootSchema, className);

            if (!schema) {
              rootSchema.definitions[className] = {
                ...getSchemaObject({ className }),
                originalName: allowed,
                isEnumRef: true,
              };
            } else if (!schema.isEnumRef) {
              throw Error(`Duplicate class definition - ${className}`);
            }

            return {
              [pathProperty]: path,
              $ref: `#/definitions/${className}`,
            };

          } else {

            // Since, this will create a top-level class, we need to verify that
            // there are no other definitions with the same name.
            if (getSchemaDefinition(rootSchema, className)) {
              throw Error(`Duplicate class definition - ${className}`);
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
