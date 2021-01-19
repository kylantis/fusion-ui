
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

  static componentTypes = {};


  static getClassName({ key }) {
    return getAlias(key);
  }

  static createSchema({ data, className, config }) {
    const { unwrapObject, componentTypes } = SchemaGenerator;

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
      componentTypes
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
      pathProperty, valueProperty, componentTypes, typeProperty,
      getClassName, getWrappedValue, getSchemaObject,
    } = SchemaGenerator;

    const keys = Object.keys(wrapper[valueProperty]).filter(k => k !== typeProperty);

    if (rootSchema.definitions[className]) {
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
      const v = getWrappedValue({
        rootSchema,
        className: getClassName({ key }),
        wrapper: wrapper[valueProperty][key],
        config,
      });

      schema.properties[key] = v;

      if (v.$ref) {
        const typeName = v.$ref.replace('#/definitions/', '');
        if (rootSchema.definitions[typeName].isRef) {
          (componentTypes[className] || (componentTypes[className] = []))
            .push(typeName);
        }
      }
    });

    if (wrapper[pathProperty]) {
      rootSchema.paths[wrapper[pathProperty]] = `#/definitions/${className}`
    }

    return `#/definitions/${className}`;
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
      getClassName,
    } = SchemaGenerator;

    switch (wrapper[typeProperty]) {
      case componentRefType:
        className = wrapper[nameProperty];
        rootSchema.definitions[className] = {
          ...getSchemaObject({ className }),
          isRef: true,
        };
        return {
          $ref: `#/definitions/${className}`,
        };

      case mapType:

        const mapKeys = Object.keys(wrapper[valueProperty]);

        const newWrapper = {};
        newWrapper[valueProperty] = wrapper[valueProperty][
          mapKeys[0]
        ];

        return {
          type: 'object',
          additionalProperties: {
            $ref: unwrapObject({
              rootSchema,
              className,
              wrapper: newWrapper,
              config,
            }),
          },
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

        const elementWraper = wrapper[valueProperty][0];

        // If elementWrapper is a type that would need be unwrapped via
        // unwrapObject(...), e.g. map or object, we should pass in className.
        const elementClassName = (() => {
          switch (elementWraper[typeProperty]) {
            case mapType:
            case objectType:

              return getClassName({
                key: config.arrays[wrapper[pathProperty]].singularType
              });
            default: return null;
          }
        })();

        return {
          type: 'array',
          items: getWrappedValue({
            rootSchema,
            className: elementClassName,
            wrapper: elementWraper,
            config,
          }),
        };
      case literalType:
      default:

        const { allowed, type } = config.literals[wrapper[pathProperty]];

        if (allowed && allowed.length) {
          // Since, this will create a top-level class, we need to verify that
          // there are no other definitions with the same name.
          if (rootSchema.definitions[className]) {
            throw new Error(`Duplicate class definition - ${className}`);
          }

          return {
            enum: allowed
          };

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
