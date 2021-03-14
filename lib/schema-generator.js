
const { getAlias } = require('./utils');
const assert = require('assert');
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

  static componentTypes = {};

  static enumTypes = {};

  static getClassName({ key }) {
    return getAlias(key);
  }

  static createSchema({ data, className, config }) {
    const { unwrapObject, componentTypes, enumTypes } = SchemaGenerator;

    const rootSchema = {
      $schema: 'http://json-schema.org/draft-06/schema#',
      $ref: `#/definitions/${className}`,
      definitions: {},
      paths: {}
    };

    unwrapObject({
      rootSchema, className, wrapper: data, config, root: true,
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
  }) {
    const {
      pathProperty, valueProperty,
      componentTypes, enumTypes, typeProperty,
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
      // f multiple fields in this object have an array-based enum
      // that contain exactly the same items, mandate them to use an
      // enum reference. This is important because if quicktype can
      // apply heuristics that are non-determiinstic

      const v = getWrappedValue({
        rootSchema,
        className: getClassName({ key }),
        wrapper: wrapper[valueProperty][key],
        config,
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

    if (wrapper[pathProperty]) {
      rootSchema.paths[wrapper[pathProperty]] = `#/definitions/${className}`
    }

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
    rootSchema, className, wrapper, config,
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
          type: 'object',
          additionalProperties: getWrappedValue({
            rootSchema,
            className: mapSingularClassName,
            wrapper: newMapWrapper,
            config,
          }),
        };

      case objectType:

        return {
          $ref: unwrapObject({
            rootSchema,
            className,
            wrapper,
            config,
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
          type: 'array',
          items: getWrappedValue({
            rootSchema,
            className: arraySingularClassName,
            wrapper: newArrayWrapper,
            config,
          }),
        };
      case literalType:
        assert(wrapper[valueProperty] !== '[]');
      default:

        const { allowed, type } = wrapper[pathProperty] ?
          config.literals[wrapper[pathProperty]]
          : {};

        if (allowed && allowed.length) {

          const isEnumRef = typeof allowed == 'string';

          if (isEnumRef) {

            className = getClassName({ key: allowed });
            const schema = getSchemaDefinition(rootSchema, className);

            if (!schema) {
              rootSchema.definitions[className] = {
                ...getSchemaObject({ className }),
                isEnumRef: true,
              };
            } else if (!schema.isEnumRef) {
              throw new Error(`Duplicate class definition - ${className}`);
            }

            return {
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
            rootSchema.definitions[className] = getSchemaObject({ className });

            return {
              enum: allowed
            };
          }

        } else {
          return {
            // Are default values supported in quicktype?
            type: getLiteralValue({
              type,
            }).constructor.name.toLowerCase(),
          };
        }
    }
  }
}

module.exports = SchemaGenerator;
