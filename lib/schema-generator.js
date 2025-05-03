/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const assert = require('assert');
const fs = require('fs');

const utils = require('./utils');
const { toCanonicalPath } = require('../src/assets/js/client-utils');
const SchemaError = require('./schema-error');
class SchemaGenerator {

  static nameProperty = '@name';

  static typeProperty = '@type';

  static typeConfigProperty = 'type';

  static allowedConfigProperty = 'allowed';

  static pathProperty = '@path';

  static valueProperty = '@value';

  static hookProperty = '@callback';

  static literalType = 'Literal';

  static arrayType = 'Array';

  static objectType = 'Object';

  static mapType = 'Map';

  static componentRefType = 'componentRef';

  static minLengthProperty = 'minLength';

  static singularTypeConfigProperty = 'singularType';

  static keyTypeConfigProperty = 'keyType';

  static schemaRootName = 'this';

  static derivedTypeStrategy = 'derivedType';

  static referenceStrategy = 'reference';

  static wordPattern = /^\w+$/g;

  static throwError(msg) {
    SchemaGenerator.preprocessor.throwError(
      new SchemaError(msg)
    );
  }

  static getClassNameForKey(key) {
    return utils.getAlias(key);
  }

  static inlineSharedTypeClassName(sharedTypes, path) {
    // If <path> is part of a shared type, transform <path> to use the class name of the shared type instead
    for (const { paths, className } of sharedTypes) {
      for (const p of paths) {
        if (path.startsWith(p)) {
          return path.replace(p, className);
        }
      }
    }

    return path;
  }

  static getCollectionParent(path) {
    for (const s of ['_$', '.$_']) {
      if (path.endsWith(s)) {
        return utils.update(path, s, '', true);
      }
    }

    return null;
  }

  static getClassNameForPath(sharedTypes, path, config) {
    const {
      getSingularTypeForColl, getClassNameForKey, inlineSharedTypeClassName, getCollectionParent
    } = SchemaGenerator;

    let className;

    const collParent = getCollectionParent(path);

    if (collParent) {
      // If parent is a collection, use <singularType>
      className = getSingularTypeForColl(
        inlineSharedTypeClassName(sharedTypes, collParent), config
      );
    } else {
      // parent is an object, use the property key
      className = getClassNameForKey(utils.peek(path.split('.')));
    }

    return className;
  }

  static visitConfigObject(obj, prefix, consumer) {
    Object.keys(obj).forEach(key => {
      const p = `${prefix}.`;
      if (key.startsWith(p)) {
        consumer(key.replace(p, ''));
      }
    });
  }

  static pruneConfig({ config, resolver, data, sharedTypes, logger }) {

    const {
      mapType, arrayType, literalType, componentRefType, derivedTypeStrategy, typeConfigProperty, allowedConfigProperty,
      singularTypeConfigProperty, keyTypeConfigProperty, getCanonicalPaths,
    } = SchemaGenerator;

    const { sharedTypes: sharedTypesConfig = {}, collections, scalars } = config;

    const derivedTypes = Object.entries(sharedTypes)
      .filter(([key, { strategy }]) => strategy == derivedTypeStrategy)
      .map(([key]) => key);

    Object.keys(sharedTypesConfig)
      .filter(k => !derivedTypes.includes(k))
      .forEach((k) => {
        delete sharedTypesConfig[k];
      });

    let collectionPaths = getCanonicalPaths({ data, types: [mapType, arrayType] });
    let scalarPaths = getCanonicalPaths({ data, types: [literalType, componentRefType] });

    Object.values(sharedTypes)
      .filter(({ strategy }) => strategy == derivedTypeStrategy)
      .forEach(({ className, scalars, collections }) => {
        collectionPaths = collectionPaths.concat(Object.keys(collections).map(k => `${className}.${k}`));
        scalarPaths = scalarPaths.concat(Object.keys(scalars).map(k => `${className}.${k}`));
      });


    const prunedScalars = {};

    Object.keys(scalars)
      .filter(k => !scalarPaths.includes(k))
      .forEach(k => {
        prunedScalars[k] = scalars[k];
        delete scalars[k];
      });

    Object.values(scalars).forEach(config => {
      const { [typeConfigProperty]: type, [allowedConfigProperty]: allowed } = config;

      if (type.$ref && prunedScalars[type.$ref]) {
        config[typeConfigProperty] = prunedScalars[type.$ref][typeConfigProperty];
      }

      if (allowed && allowed.$ref && prunedScalars[allowed.$ref]) {
        config[allowedConfigProperty] = prunedScalars[allowed.$ref][allowedConfigProperty];
      }
    });


    const prunedCollections = {};

    Object.keys(collections)
      .filter(k => !collectionPaths.includes(k))
      .forEach(k => {
        prunedCollections[k] = collections[k];
        delete collections[k];
      });


    Object.values(collections).forEach(config => {
      const { [singularTypeConfigProperty]: singularType, [keyTypeConfigProperty]: keyType } = config;

      if (singularType && singularType.$ref && prunedCollections[singularType.$ref]) {
        config[singularTypeConfigProperty] = prunedCollections[singularType.$ref][singularTypeConfigProperty];
      }

      if (keyType && keyType.$ref && prunedCollections[keyType.$ref]) {
        config[keyTypeConfigProperty] = prunedCollections[keyType.$ref][keyTypeConfigProperty];
      }
    });

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

  static getSharedTypes({ data, resolver, config }) {
    const {
      pathProperty, valueProperty, typeProperty, objectType, schemaRootName, derivedTypeStrategy, referenceStrategy,
      wordPattern, throwError, getCanonicalPaths,
    } = SchemaGenerator;

    const { getSharedTypePrefix } = resolver.constructor;

    const schemaStrings = {};

    const stringifySchema = (path, value) => {
      return JSON.stringify(value, (key, val) => {

        if (val && val.constructor.name === 'Object' && val[pathProperty]) {

          const p = val[pathProperty];

          const o = {
            ...val,
            [pathProperty]: p.replace(path, schemaRootName)
          };

          if (schemaStrings[p] != undefined) {
            return schemaStrings[p]
              .replaceAll(schemaRootName, o[pathProperty])
          }

          return o;
        }

        return val;
      })
        .replace(/"\{/g, "{")
        .replace(/\}"/g, "}")
        .replace(/"/g, "%%");
    }

    const dataArray = Object.entries(data)
      .filter(([key]) => ![typeProperty, valueProperty].includes(key));

    for (let i = dataArray.length - 1; i >= 0; i--) {
      const [key, val] = dataArray[i];

      const { [pathProperty]: path } = val;

      assert(!schemaStrings[path]);
      schemaStrings[path] = stringifySchema(path, val);
    }


    Object.keys(schemaStrings).forEach(k => {
      schemaStrings[k] = schemaStrings[k].replace(/%%/g, '"');
    });

    const schemaStringsInfo = {};
    const sharedPaths = [];

    const schemaStringsKeys = Object.keys(schemaStrings);

    for (let i = schemaStringsKeys.length - 1; i >= 0; i--) {
      const key = schemaStringsKeys[i];
      const value = schemaStrings[key];

      if (!value.startsWith(`{"@type":"${objectType}"`)) {
        continue;
      }

      if (!schemaStringsInfo[value]) {
        schemaStringsInfo[value] = { paths: [], schemaString: value, strategy: derivedTypeStrategy };
      }

      const info = schemaStringsInfo[value];

      info.paths.push(key);

      if (info.paths.length > 1) {

        const { strategy } = info;

        if (strategy == derivedTypeStrategy) {
          for (const p of sharedPaths) {
            if (key.startsWith(p)) {
              // The parent path is already is shared type, hence a derived type cannot be created, use reference strategy instead
              info.strategy = referenceStrategy;
              break;
            }
          }
        }

        if (info.paths.length == 2) {
          sharedPaths.push(info.paths[0]);
        }

        sharedPaths.push(key);
      }
    }


    let derivedTypePaths = [];

    Object.entries(schemaStringsInfo)
      .filter(([k, { paths }]) => paths.length > 1)
      .forEach(([k, v]) => {
        const { paths, strategy } = v;

        if (strategy == derivedTypeStrategy) {
          derivedTypePaths = derivedTypePaths.concat(paths);
        } else {
          let derivedSubPaths = [];

          for (const p of derivedTypePaths) {
            derivedSubPaths = [...new Set(
              derivedSubPaths.concat(paths.filter(x => x.startsWith(p)))
            )];
          }
          if (derivedSubPaths.length == paths.length) {
            // All paths are derived subPaths, so this should be pruned
            delete schemaStringsInfo[k];
          }
        }
      });


    const sharedTypes = {};
    const sharedTypesConfig = config.sharedTypes || (config.sharedTypes = {});


    Object.values(schemaStringsInfo)
      .filter(({ paths }) => paths.length > 1)
      .forEach(({ paths, schemaString, strategy }, index) => {

        const key = `${getSharedTypePrefix()}${index}`;

        const throwErr = (prop, msg) => {
          throwError(`[config.sharedTypes.${key}.${prop}]: ${msg}`)
        }

        sharedTypes[key] = { paths, schemaString, strategy };

        if (strategy == derivedTypeStrategy) {
          const { className } = sharedTypesConfig[key] || (sharedTypesConfig[key] = { className: key });

          if (!className) {
            throwErr('className', `A value is required for [className]`)
          }
          if (typeof className != 'string' || !className.match(wordPattern)) {
            throwErr('className', `"${className}" should be a valid word`)
          }
          if (getCanonicalPaths({ data }).includes(className)) {
            throwErr('className', `"${className}" should not be a data path`)
          }

          sharedTypes[key].className = className;
        }
      });

    return sharedTypes;
  }

  static visitWrapper(rootSchema, wrapper, fn) {
    const {
      pathProperty, typeProperty, mapType, valueProperty, arrayType, objectType, visitWrapper,
    } = SchemaGenerator;

    assert(wrapper[pathProperty]);

    fn(wrapper);

    switch (true) {
      case wrapper[typeProperty] == mapType:
      case wrapper[typeProperty] == arrayType:
        visitWrapper(
          rootSchema, Object.values(wrapper[valueProperty])[0], fn
        );
        break;
      case !!wrapper.$ref:
        const definition = rootSchema.definitions[
          wrapper.$ref.replace('#/definitions/', '')
        ];

        Object.values(definition.properties)
          .forEach(v => {
            visitWrapper(rootSchema, v, fn)
          })

        break;
      case wrapper[typeProperty] == objectType:
        Object.values(wrapper[valueProperty])
          .forEach(v => {
            visitWrapper(rootSchema, v, fn)
          })
        break;
    }
  }

  static mergeTypes({ data, config, resolver, rootSchema, logger, opts }) {

    const {
      typeConfigProperty, allowedConfigProperty, typeProperty, valueProperty, hookProperty, objectType, pathProperty,
      singularTypeConfigProperty, schemaRootName, derivedTypeStrategy, getSharedTypes, visitConfigObject, unwrapObject,
      throwError, getClassNameForPath, inlineSharedTypeClassName, visitWrapper, getDescription, getCollectionParent,
    } = SchemaGenerator;

    const {
      keyTypeConfigProperty, toRealPath, isScalarType, isCollectionType, minLengthConfigProperty, getLiteralTypes,
    } = resolver.constructor;

    const sharedTypes = getSharedTypes({ data, resolver, config });

    // This is used to keep track of ref wrappers that exists in derived types that have been processed into
    // <rootSchema>
    const derivedSubPaths = {};

    const sharedTypesValues = Object.values(sharedTypes);

    sharedTypesValues.forEach((sharedType, sharedTypeIndex) => {

      let { paths, schemaString, strategy, className } = sharedType;

      const isDerived = strategy == derivedTypeStrategy;

      assert(isDerived || sharedTypeIndex > 0)

      const fullyQualifiedPath = isDerived ? className : inlineSharedTypeClassName(
        sharedTypesValues.slice(0, sharedTypeIndex), paths[0]
      )

      if (!className) {
        assert(!isDerived);

        className = getClassNameForPath(
          sharedTypesValues.slice(0, sharedTypeIndex).reverse(),
          paths[0], config,
        );
      }


      paths.forEach(path => {
        const colConfig = config.collections[getCollectionParent(path)];

        // If <path> is a collection child path, prune <singularType> because it's not needed
        if (colConfig) {
          delete colConfig[singularTypeConfigProperty];
        }
      });


      // Prepare scalar entries for sharedType
      const scalars = sharedType.scalars = {};

      visitConfigObject(config.scalars, paths[0], (subPath) => {

        const wrapper = data[toRealPath(`${paths[0]}.${subPath}`)];

        if (!wrapper || !isScalarType(wrapper)) {
          return;
        }

        let baseScalarConfig;

        // for each path in <paths>, we need to verify their schema, as defined in config

        paths
          .forEach((p, i) => {
            const scalarConfig = config.scalars[`${p}.${subPath}`];

            let { [allowedConfigProperty]: allowed, [typeConfigProperty]: type } = scalarConfig;

            // Resolve references, if applicable

            if (type.$ref) {
              type = scalarConfig[typeConfigProperty] = config.scalars[type.$ref][typeConfigProperty];
            }

            if (allowed && allowed.$ref) {
              allowed = scalarConfig[allowedConfigProperty] = config.scalars[allowed.$ref][allowedConfigProperty];
            }


            // Use lowercase, inorder to maintain uniformity - as we would be performing equality checks
            if (getLiteralTypes().includes(type.toLowerCase())) {
              type = scalarConfig[typeConfigProperty] = type.toLowerCase();
            }

            if (i == 0) {
              baseScalarConfig = scalarConfig;

              if (allowed && type != 'string') {
                throwError(`Unknown config property <config.scalar['${p}.${subPath}'].${allowedConfigProperty}>`);
              }

            } else {

              const expectSameScalarConfigProp = (prop) => {
                throwError(
                  `"<config.scalar['${p}.${subPath}'].${prop}> should match <config.scalar['${paths[0]}.${subPath}'].${prop}> `
                )
              }

              if (type != baseScalarConfig[typeConfigProperty]) {
                expectSameScalarConfigProp(typeConfigProperty);
              }

              if (allowed) {
                if ((typeof allowed == 'string' && allowed != baseScalarConfig[allowedConfigProperty]) || !utils.arrayEquals(allowed, baseScalarConfig[allowedConfigProperty])) {
                  expectSameScalarConfigProp(allowedConfigProperty);
                }
              }
            }
          });

        const k = `${fullyQualifiedPath}.${subPath}`;

        const sharedScalarConfig = {
          [typeConfigProperty]: baseScalarConfig[typeConfigProperty],
          [allowedConfigProperty]: baseScalarConfig[allowedConfigProperty]
        };

        scalars[subPath] = config.scalars[k] = config.scalars[k] || sharedScalarConfig;

        // Update the scalar config use reference instead
        paths
          .map(p => `${p}.${subPath}`)
          .forEach(p => {
            // Note: This is only for informational purpose
            config.scalars[p][typeConfigProperty] = { $ref: k }

            if (config.scalars[k][allowedConfigProperty]) {
              // Note: This is only for informational purpose
              config.scalars[p][allowedConfigProperty] = { $ref: k }
            }
          });
      });



      // Prepare collection entries for sharedType
      const collections = sharedType.collections = {};

      visitConfigObject(config.collections, paths[0], (subPath) => {

        const wrapper = data[
          toRealPath(`${paths[0]}.${subPath}`)
        ];

        if (!wrapper || !isCollectionType(wrapper)) {
          return;
        }

        const k = `${fullyQualifiedPath}.${subPath}`;

        config.collections[k] = resolver.getCollectionConfig(k, wrapper, config);

        // If applicable, prune unwanted properties from getCollectionConfig(...) above
        delete config.collections[k][minLengthConfigProperty];

        if (Object.keys(config.collections[k]).length) {
          collections[subPath] = config.collections[k];
          paths
            .map(p => `${p}.${subPath}`)
            .forEach(p => {
              if (config.collections[k][singularTypeConfigProperty]) {
                // Note: This is only for informational purpose
                config.collections[p][singularTypeConfigProperty] = { $ref: k };
              } else {
                delete config.collections[p][singularTypeConfigProperty];
              }

              if (config.collections[k][keyTypeConfigProperty]) {
                // Note: This is only for informational purpose
                config.collections[p][keyTypeConfigProperty] = { $ref: k };
              } else {
                delete config.collections[p][keyTypeConfigProperty];
              }
            });
        } else {
          // collectionConfig is empty, prune
          delete config.collections[k];
        }
      });


      if (isDerived) {

        const registerDerivedSubPath = (wrapper) => {
          derivedSubPaths[wrapper[pathProperty][0]] = wrapper;
        }

        const sharedTypeWrapper = {
          [typeProperty]: objectType,
          [valueProperty]: JSON.parse(schemaString, (key, val) => {
            if (val && val.constructor.name === 'Object' && val[pathProperty]) {
              val[pathProperty] = [
                val[pathProperty].replace(schemaRootName, className),
                ...paths.map(p => val[pathProperty].replace(schemaRootName, p))
              ];

              if (val[typeProperty] == objectType) {
                val[hookProperty] = registerDerivedSubPath;
              }
            }
            return val;
          })[valueProperty]
        }

        unwrapObject({
          rootSchema, className, shared: true,
          wrapper: sharedTypeWrapper, config, logger,
          ...opts,
        });

        paths
          .map(toRealPath).forEach((k) => {
            assert(!!data[k]);

            utils.clear(data[k]);

            data[k][pathProperty] = [className, ...paths];
            data[k].$ref = `#/definitions/${className}`;
          });

      } else {

        paths
          .map(toRealPath).forEach((k) => {
            const wrapper = data[k];
            const { [pathProperty]: path } = wrapper;

            if (Array.isArray(path)) {
              assert(path[0] == fullyQualifiedPath);

              // This is done only for reference purpose, and has no effect since it has been
              // processed into <rootSchema>
              paths.forEach(p => {
                if (!path.includes(p)) {
                  path.push(p);
                }
              });

            } else {
              utils.clear(wrapper);

              wrapper[pathProperty] = [fullyQualifiedPath, ...paths];
              wrapper.$ref = `#/definitions/${className}`;
            }
          });

        const wrapper = derivedSubPaths[fullyQualifiedPath];
        assert(wrapper);

        paths.forEach(p => {
          if (!wrapper[pathProperty].includes(p)) {
            wrapper[pathProperty].push(p);
          }
        });

        // Since path has changed, update description
        wrapper.description = getDescription({ path: wrapper[pathProperty] });


        const definition = rootSchema.definitions[className];
        assert(definition);

        Object.values(definition.properties)
          .forEach(v => {
            visitWrapper(rootSchema, v, (wrapper) => {
              const { [pathProperty]: path } = wrapper;

              assert(
                Array.isArray(path) && path[0].startsWith(fullyQualifiedPath)
              );

              const suffix = path[0].replace(fullyQualifiedPath, '');
              paths
                .map(p => `${p}${suffix}`)
                .forEach(p => {
                  if (!path.includes(p)) {
                    path.push(p);
                  }
                });

              // Since path has changed, update description
              wrapper.description = getDescription({ path });
            })
          });
      }
    });

    return sharedTypes;
  }

  static createSchema({ data, preprocessor, config }) {

    const { unwrapObject, mergeTypes, pruneConfig } = SchemaGenerator;

    SchemaGenerator.preprocessor = preprocessor;

    const { className, resolver, logger } = preprocessor;

    const componentTypes = {};
    const enumTypes = {};

    const rootSchema = {
      $schema: 'http://json-schema.org/draft-06/schema#',
      $ref: `#/definitions/${className}`,
      definitions: {},
      pathRefs: [],
    };

    const opts = { componentTypes, enumTypes };

    const sharedTypes = config.enableTypeMerging ?
      mergeTypes({
        data, config, resolver, rootSchema,
        logger, opts
      }) : {}

    pruneConfig({
      config, data, resolver, logger, sharedTypes
    });

    unwrapObject({
      rootSchema, className, wrapper: data, config, root: true, logger,
      ...opts
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
    rootSchema, className, wrapper, config, root = false, logger, shared = false, componentTypes, enumTypes
  }) {
    const {
      pathProperty, valueProperty, typeProperty, getClassNameForKey, getWrappedValue, getSchemaObject,
      getSchemaDefinition, processRef, getDescription, throwError,
    } = SchemaGenerator;

    const value = wrapper[valueProperty];
    const keys = Object.keys(value)

      .filter(k => k !== typeProperty);

    if (getSchemaDefinition(rootSchema, className)) {
      throwError(
        `Duplicate class definition - ${className}. Do you need to "enableTypeMerging" for this component?`
      );
    }

    const schema = getSchemaObject({ required: keys, className });

    if (shared) {
      schema.shared = true;
    }

    if (root) {
      schema.isRootDefinition = true;
    }

    rootSchema.definitions[className] = schema;

    keys.forEach((key) => {

      // Todo: 
      // If multiple fields in this object have an array-based enum
      // that contain exactly the same items, mandate them to use an
      // enum reference. This is important because quicktype can
      // apply heuristics that is non-determiinstic

      const path = wrapper[valueProperty][key][pathProperty];

      const v = getWrappedValue({
        rootSchema,
        className: getClassNameForKey(key),
        typeName: className,
        wrapper: wrapper[valueProperty][key],
        config, logger, shared,
        path,
        componentTypes, enumTypes
      });

      v.description = getDescription({ path });

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
    switch (type.toLowerCase()) {
      case 'boolean': return true;
      case 'number': return 0;
      case 'string': default: return '';
    }
  }

  static getSupportedLiteralTypes() {
    return [
      'boolean', 'number', 'string'
    ];
  }

  static processRef({ $ref, rootSchema, componentTypes, enumTypes, className }) {
    const typeName = $ref.replace('#/definitions/', '');

    if (rootSchema.definitions[typeName].isComponentRef) {
      (componentTypes[className] || (componentTypes[className] = []))
        .push(typeName);
    }

    if (rootSchema.definitions[typeName].isEnumRef) {
      (enumTypes[className] || (enumTypes[className] = []))
        .push(typeName);
    }
  }

  static getDescription({ path }) {
    return JSON.stringify({ path });
  }

  static getSingularTypeForColl(path, config) {
    const { singularTypeConfigProperty, getClassNameForKey, throwError } = SchemaGenerator;
    let singularType = config.collections[path][singularTypeConfigProperty];

    if (!singularType) {
      throwError(`No "singularType" was defined for collection path "${path}"`);
    }

    assert(typeof singularType == 'string');
    return getClassNameForKey(singularType);
  }

  static getWrappedValue({
    rootSchema, typeName, className, wrapper, config, path, shared, logger, componentTypes, enumTypes
  }) {
    const {
      nameProperty, typeProperty, typeConfigProperty, allowedConfigProperty, valueProperty, pathProperty,
      objectType, arrayType, literalType, mapType, componentRefType, hookProperty, keyTypeConfigProperty,
      getLiteralValue, unwrapObject, getWrappedValue, getSchemaObject, processRef, throwError,
      getClassNameForKey, getSchemaDefinition, getSupportedLiteralTypes, getDescription, getSingularTypeForColl,
    } = SchemaGenerator;

    if (typeof path == 'string') {
      path = [path];
    }
    assert(path && !!path.length);

    const getSingularClassName = (wrapper) => {
      switch (wrapper[typeProperty]) {
        case objectType:
          return getSingularTypeForColl(path[0], config);
        default: return null;
      }
    }

    // Note: callers should maintain reference to <wrapper> on the <rootSchema>, because the callback functions 
    // need to maintain the same reference
    const invokeRefHook = (wrapper, fn) => {
      const { [pathProperty]: path, $ref } = wrapper;
      assert($ref && Array.isArray(path));

      if (typeof fn == 'function') {
        fn(wrapper);
      }

      path.forEach(p => {
        rootSchema.pathRefs[p] = $ref.replace('#/definitions/', '');
      });

      return wrapper;
    }

    switch (true) {
      case wrapper[typeProperty] == componentRefType:
        const baseComponentClassName = SchemaGenerator.preprocessor.getDeclaredBaseComponent();
        
        className = wrapper[nameProperty];

        if (className == BaseComponent.name) {
          className = baseComponentClassName;
        }

        if (!rootSchema.definitions[className]) {
          rootSchema.definitions[className] = {
            ...getSchemaObject({ className }),
            isComponentRef: true,
          };
        } else {
          // A definition exists with the same name. If the existing definition is neither a component ref nor
          // the root schema definition, throw an error indicating a duplicate class name

          const definition = rootSchema.definitions[className];

          if (
            !definition.isComponentRef &&
            SchemaGenerator.preprocessor.className !== className
          ) {
            throwError(`Duplicate class definition - ${className}`);
          }
        }

        return invokeRefHook(
          {
            [pathProperty]: path,
            $ref: `#/definitions/${className}`,
          }, wrapper[hookProperty]
        );

      case wrapper[typeProperty] == mapType:

        const { [keyTypeConfigProperty]: keyType = 'String' } = config.collections[path[0]];

        const mapChildWrapper = wrapper[valueProperty][
          Object.keys(wrapper[valueProperty])[0]
        ];

        const mapVal = mapChildWrapper.$ref ? invokeRefHook(mapChildWrapper, mapChildWrapper[hookProperty]) :
          getWrappedValue({
            rootSchema,
            typeName,
            className: getSingularClassName(mapChildWrapper, wrapper),
            wrapper: mapChildWrapper,
            config, logger, shared,
            path: mapChildWrapper[pathProperty],
            componentTypes, enumTypes
          });

        if (mapVal.$ref) {
          processRef({ $ref: mapVal.$ref, rootSchema, componentTypes, enumTypes, className: typeName });
          mapVal.description = getDescription({ path: mapChildWrapper[pathProperty] });
        }

        return {
          [pathProperty]: path,
          type: 'object',
          keyType,
          additionalProperties: mapVal,
        };

      case wrapper[typeProperty] == arrayType:

        const arrayChildWrapper = wrapper[valueProperty][0];

        const items = arrayChildWrapper.$ref ? invokeRefHook(arrayChildWrapper, arrayChildWrapper[hookProperty]) :
          getWrappedValue({
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
          items.description = getDescription({ path: arrayChildWrapper[pathProperty] });
        }

        return {
          [pathProperty]: path,
          type: 'array',
          items,
        };

      case !!wrapper.$ref:
        return invokeRefHook(wrapper, wrapper[hookProperty]);

      case wrapper[typeProperty] == objectType:
        return invokeRefHook({
          [pathProperty]: path,
          $ref: unwrapObject({
            rootSchema,
            className,
            wrapper,
            config, shared,
            componentTypes, enumTypes
          }),
        }, wrapper[hookProperty]);

      default:
        assert(wrapper[typeProperty] == literalType && wrapper[valueProperty] !== '[]');

        let { [allowedConfigProperty]: allowed, [typeConfigProperty]: type } = config.scalars[path[0]];

        // Note: we really don't expect path[0] to reference any paths
        assert(typeof type == 'string');
        assert(!allowed || Array.isArray(allowed) || typeof allowed == 'string');

        if (type && !getSupportedLiteralTypes().includes(type.toLowerCase())) {
          throwError(
            `Unknown type defined in config.scalars for path "${path[0]}", expected a literal type but found "${type}"`
          );
        }

        if (allowed && allowed.length) {

          const isEnumRef = typeof allowed == 'string';

          if (isEnumRef) {

            className = getClassNameForKey(allowed);
            const schema = getSchemaDefinition(rootSchema, className);

            if (!schema) {
              rootSchema.definitions[className] = {
                ...getSchemaObject({ className }),
                originalName: allowed,
                isEnumRef: true,
              };
            } else if (!schema.isEnumRef) {
              throwError(`Duplicate class definition - ${className}`);
            }

            return {
              [pathProperty]: path,
              $ref: `#/definitions/${className}`,
            };

          } else {

            // Since, this will create a top-level class, we need to verify that
            // there are no other definitions with the same name.
            if (getSchemaDefinition(rootSchema, className)) {
              throwError(`Duplicate class definition - ${className}`);
            }

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
