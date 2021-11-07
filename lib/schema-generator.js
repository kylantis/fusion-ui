
const assert = require('assert');
const fs = require('fs');

const { getAlias } = require('./utils');
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

  static mergeTypes({ rootSchema, config, resolver }) {

    const sharedTypeNames = config.sharedTypeNames || (config.sharedTypeNames = {});

    const keys = Object.keys(rootSchema.definitions);
    const types = {};

    loop:
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const schema = JSON.stringify(rootSchema.definitions[k]);

      for (const [key, value] of Object.entries(types)) {
        if (schema == value.schema) {
          value.refCount++;
          rootSchema.definitions[k] = {
            $ref: `#/definitions/${key}`
          }

          continue loop;
        }
      }

      const typeName = `SharedType${Object.keys(types).length}`;

      if (sharedTypeNames[typeName]) {
        typeName = sharedTypeNames[typeName];

        assert(typeof typeName == 'string');
      } else {
        sharedTypeNames[typeName] = typeName;
      }

      if (rootSchema.definitions[typeName]) {
        throw Error(`Duplicate Type: ${typeName}`);
      }

      types[typeName] = {
        refCount: 1,
        schema
      }
    }

    // Prune types
    for (const k in types) {
      if (types[k].refCount == 1) {
        delete types[k];
      }
    }

    // Prune sharedTypeNames and store updated config
    for (const k in sharedTypeNames) {
      if (!types[sharedTypeNames[k]]) {
        delete sharedTypeNames[k];
      }
    }
    fs.writeFileSync(resolver.getConfigPath(), JSON.stringify(config, null, 2));

    // Add shared type(s) to rootSchema.definitions
    Object.entries(types).forEach(([key, { schema }]) => {
      rootSchema.definitions[key] = {
        ...JSON.parse(schema),
        shared: true
      };
    });
  }

  static createSchema({ data, preprocessor, config }) {

    const { className, resolver } = preprocessor;

    const componentTypes = {};
    const enumTypes = {};

    const { unwrapObject, mergeTypes } = SchemaGenerator;

    const rootSchema = {
      $schema: 'http://json-schema.org/draft-06/schema#',
      $ref: `#/definitions/${className}`,
      definitions: {},
    };

    unwrapObject({
      rootSchema, className, wrapper: data, config, root: true,
      componentTypes, enumTypes
    });

    if (config.enableTypeMerging) {
      mergeTypes({ rootSchema, config, resolver });
    }

    preprocessor.logger.info(JSON.stringify(rootSchema));

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

  static getWrappedValue({
    rootSchema, className, wrapper, config, path, componentTypes, enumTypes
  }) {
    const {
      nameProperty, typeProperty, valueProperty, pathProperty,
      objectType, arrayType, literalType, mapType, componentRefType,
      getLiteralValue, unwrapObject, getWrappedValue, getSchemaObject,
      getClassName, getSchemaDefinition,
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
