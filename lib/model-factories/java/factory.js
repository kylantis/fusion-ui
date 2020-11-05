/* eslint-disable no-case-declarations */
/* eslint-disable no-unused-vars */

/* eslint-disable no-return-await */
/* eslint-disable no-param-reassign */
const {
  quicktypeMultiFile,
  InputData,
  JSONSchemaInput,
  JSONSchemaStore,
} = require('quicktype-core');
const assert = require('assert');
const pathLib = require('path');
const fs = require('fs');
const shelljs = require('shelljs');
const {
  baseComponentIdField,
  baseComponentPkg,
  baseComponentClassName,
  pkgName,
  create: targetLanguageFactory,
} = require('./qt-target-language-java');
const { getAlias } = require('../../utils');
const jarBuilder = require('../java/jar-builder');
const { nameProperty } = require('../../path-resolver');

class ModelFactory {
  static typeProperty = '@type';

  static pathProperty = '@path';

  static valueProperty = '@value';

  static literalType = 'Literal';

  static arrayType = 'Array';

  static objectType = 'Object';

  static mapType = 'Map';

  static componentRefType = 'componentRef';

  static cleanupSourceFiles = false;

  static componentRefs = {};

  static getBaseComponentSrcFile() {
    const { getBuildFolder } = ModelFactory;

    const dir = pathLib.join(
      getBuildFolder(),
      ...baseComponentPkg.split('.'),
    );
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = pathLib.join(dir, `${baseComponentClassName}.java`);

    if (!fs.existsSync(file)) {
      fs.writeFileSync(
        file,
        `
          package ${baseComponentPkg};
          public class ${baseComponentClassName} {
            protected ${baseComponentClassName}(String id) {}
          }`,
      );
    }

    return file;
  }

  static getClassName({ key }) {
    return getAlias(key);
  }

  static getCp({ preprocessor, className }) {
    const cp = pathLib
      .join(
        process.env.PWD,
        'dist', 'components',
        preprocessor.getAssetIdFromClassName(className),
        'classes',
      );
    return cp;
  }

  static getBuildFolder() {
    const classesFolder = pathLib
      .join(
        process.env.PWD,
        'build',
      );

    if (!fs.existsSync(classesFolder)) {
      fs.mkdirSync(classesFolder, { recursive: true });
    }
    return classesFolder;
  }

  static getModelsPath({ assetId }) {
    const modelsFolder = pathLib
      .join(
        process.env.PWD,
        'dist', 'components', assetId, 'classes',
        ...pkgName.split('.'),
        assetId,
      );

    if (!fs.existsSync(modelsFolder)) {
      fs.mkdirSync(modelsFolder, { recursive: true });
    }
    return modelsFolder;
  }

  static getRefList() {
    const { componentRefs } = ModelFactory;
    const refList = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const [className, list] of Object.entries(componentRefs)) {
      list.forEach((ref) => {
        if (!refList.includes(ref)) {
          refList.push(ref);
        }
      });
    }
    return refList;
  }

  static async quicktypeJSONSchema({
    preprocessor, schema,
  }) {
    const {
      cleanupSourceFiles, componentRefs,
      getModelsPath, getBaseComponentSrcFile, getRefList, getCp,
    } = ModelFactory;
    const schemaInput = new JSONSchemaInput(new JSONSchemaStore());
    const { className } = preprocessor;

    // We could add multiple schemas for multiple types,
    // but here we're just making one type from JSON schema.
    await schemaInput.addSource({ name: className, schema });

    const inputData = new InputData();
    inputData.addInput(schemaInput);

    const cfg = {
      inputData,
      lang: new (
        targetLanguageFactory({ preprocessor, componentRefs })
      )(),
    };
    const dir = getModelsPath({ assetId: preprocessor.assetId });
    const sources = [];
    return await quicktypeMultiFile(cfg)
      .then((m) => {
        const refList = getRefList();

        m.forEach((value, key) => {
          if (refList.includes(key.replace('.java', ''))) {
            return;
          }
          const src = pathLib.join(dir, key);

          sources.push(src);

          fs.writeFileSync(src, value.lines.join('\n'));
        });
        return refList;
      })
      .then((refList) => {
        const cp = refList.map(ref => getCp({
          preprocessor,
          className: ref,
        }));

        // Compile java sources
        const cmd = [
          'javac',
          ...cp.length ? ['-classpath', cp.join(':')] : [],
          getBaseComponentSrcFile(),
          ...sources,
        ];

        const result = shelljs.exec(cmd.join(' '));
        if (result.code !== 0) {
          throw new Error(result.text);
        }
      })
      .then(() => {
        // If applicable, cleanup source files
        if (cleanupSourceFiles) {
          sources.forEach((src) => {
            fs.unlinkSync(src);
          });
        }
      })
      .then(() => {
        if (process.env.buildArchive) {
          // eslint-disable-next-line global-require
          jarBuilder();
        }
      });
  }

  static writePlainOldObject({
    preprocessor, data, config,
  }) {
    const {
      createSchema, quicktypeJSONSchema,
    } = ModelFactory;

    const schema = createSchema({ data, className: preprocessor.className, config });

    return quicktypeJSONSchema({
      preprocessor, schema: JSON.stringify(schema),
    });
  }

  // Todo:
  // 1. Add support for Inheritance. Note that this is done from the component
  // config json
  // 2. Create client-based model
  static createSchema({ data, className, config }) {
    const { unwrapObject } = ModelFactory;

    const rootSchema = {
      $schema: 'http://json-schema.org/draft-06/schema#',
      $ref: `#/definitions/${className}`,
      definitions: {},
    };

    unwrapObject({
      rootSchema, className, wrapper: data, config, root: true,
    });

    return rootSchema;
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
      valueProperty, componentRefs, typeProperty, getWrappedValue, getSchemaObject,
      getClassName,
    } = ModelFactory;

    const keys = Object.keys(wrapper[valueProperty]).filter(k => k !== typeProperty);

    if (rootSchema.definitions[className]) {
      // Todo: It is not possible to tell the template location of this error, fix
      // This needs to be detected ahead of time by the path resolver
      // or we could do a scan of the template for this alias
      throw new Error(`Duplicate class definition - ${className}`);
    }

    const schema = getSchemaObject({ required: keys, className });

    rootSchema.definitions[className] = schema;

    if (
      root
      && keys.filter(k => k === baseComponentIdField).length) {
      throw new Error(`Property '${baseComponentIdField}' is not allowed for class: ${className}`);
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
          (componentRefs[className] || (componentRefs[className] = []))
            .push(typeName);
        }
      }
    });


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
      typeProperty, valueProperty, pathProperty,
      objectType, arrayType, literalType, mapType, componentRefType,
      getLiteralValue, unwrapObject, getWrappedValue, getSchemaObject,
      getClassName,
    } = ModelFactory;

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
        // This should be retrieved from the typeNames mapping in config
        const elementClassName = (() => {
          switch (elementWraper[typeProperty]) {
            case mapType:
            case objectType:
              return getClassName({ key: config.typeNames[elementWraper[pathProperty]] });
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
        return {
          // Are default values supported in quicktype?
          type: getLiteralValue({
            type: config.literalTypes[wrapper[pathProperty]],
          }).constructor.name.toLowerCase(),
        };
    }
  }
}

module.exports = ModelFactory;
