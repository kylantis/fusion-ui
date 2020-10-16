
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
  create: targetLanguageFactory,
} = require('./qt-target-language-java');
const { getAlias } = require('../../utils');
const jarBuilder = require('../java/jar-builder');

class ModelFactory {
    static typeProperty = '@type';

    static pathProperty = '@path';

    static valueProperty = '@value';

    static literalType = 'Literal';

    static arrayType = 'Array';

    static objectType = 'Object';

    static mapType = 'Map';

    static cleanupSourceFiles = true;

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

    static getModelsPath({ componentName }) {
      const modelsFolder = pathLib
        .join(
          pathLib.dirname(fs.realpathSync(__filename)),
          `../../../dist/components/${componentName}/classes`,
        );

      if (!fs.existsSync(modelsFolder)) {
        fs.mkdirSync(modelsFolder, { recursive: true });
      }
      return modelsFolder;
    }

    static async quicktypeJSONSchema({
      typeName, componentName, schema,
    }) {
      const {
        cleanupSourceFiles, getModelsPath, getBaseComponentSrcFile,
      } = ModelFactory;
      const schemaInput = new JSONSchemaInput(new JSONSchemaStore());

      // We could add multiple schemas for multiple types,
      // but here we're just making one type from JSON schema.
      await schemaInput.addSource({ name: typeName, schema });

      const inputData = new InputData();
      inputData.addInput(schemaInput);

      const cfg = {
        inputData,
        lang: new (
          targetLanguageFactory({ componentName })
        )(),
      };
      const dir = getModelsPath({ componentName });
      const sources = [];
      return await quicktypeMultiFile(cfg)
        .then((m) => {
          m.forEach((value, key) => {
            const src = pathLib.join(dir, key);
            sources.push(src);
            fs.writeFileSync(src, value.lines.join('\n'));
          });
        })
        .then(() => {
          // Compile java sources
          const compileCommand = [
            'javac', getBaseComponentSrcFile(), ...sources,
          ].join(' ');
          const result = shelljs.exec(compileCommand);
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
      componentName,
      data, config,
    }) {
      const {
        createSchema, quicktypeJSONSchema,
      } = ModelFactory;

      const schema = createSchema({ data, componentName, config });

      const typeName = getAlias(componentName);

      quicktypeJSONSchema({
        typeName, componentName, schema: JSON.stringify(schema),
      });
    }

    // Todo:
    // 1. Add support for Inheritance. Note that this is done from the component
    // config json
    // 2. Create client-based model
    static createSchema({ data, componentName, config }) {
      const { unwrapObject } = ModelFactory;

      const alias = getAlias(componentName);
      const rootSchema = {
        $schema: 'http://json-schema.org/draft-06/schema#',
        $ref: `#/definitions/${alias}`,
        definitions: {},
      };

      unwrapObject({
        rootSchema, alias, wrapper: data, config, root: true,
      });

      return rootSchema;
    }

    static unwrapObject({
      rootSchema, alias, wrapper, config, root = false,
    }) {
      const {
        valueProperty, getWrappedValue,
      } = ModelFactory;

      const keys = Object.keys(wrapper[valueProperty]);

      if (rootSchema.definitions[alias]) {
        // Todo: It is not possible to tell the template location of this error, fix
        // This needs to be detected ahead of time by the path resolver
        // or we could do a scan of the template for this alias
        throw new Error(`Duplicate alias - ${alias}`);
      }

      const schema = {
        type: 'object',
        additionalProperties: false,
        required: keys,
        title: alias,
        properties: {},
      };

      rootSchema.definitions[alias] = schema;

      if (
        root
        && keys.filter(k => k === baseComponentIdField).length) {
        throw new Error(`Property '${baseComponentIdField}' is not allowed for: ${alias}`);
      }

      keys.forEach((k) => {
        schema.properties[k] = getWrappedValue({
          rootSchema,
          alias: getAlias(k),
          wrapper: wrapper[valueProperty][k],
          config,
        });
      });

      return `#/definitions/${alias}`;
    }

    static getLiteralValue({ type }) {
      switch (type) {
        case 'Boolean': return true;
        case 'Number': return 0;
        case 'String': default: return '';
      }
    }

    static getWrappedValue({
      rootSchema, alias, wrapper, config,
    }) {
      const {
        typeProperty, valueProperty, pathProperty,
        objectType, arrayType, literalType, mapType,
        getLiteralValue, unwrapObject, getWrappedValue,
      } = ModelFactory;

      switch (wrapper[typeProperty]) {
        case objectType:
        case mapType:

          if (wrapper[pathProperty].endsWith('_$')) {
            assert(alias == null && config.typeNames[wrapper[pathProperty]]);
            // Array type name defined in config
            alias = getAlias(config.typeNames[wrapper[pathProperty]]);
          }

          return {
            $ref: unwrapObject({
              rootSchema,
              alias,
              wrapper,
              config,
            }),
          };
        case arrayType:
          return {
            type: 'array',
            items: getWrappedValue({
              rootSchema,
              alias: null,
              wrapper: wrapper[valueProperty][0],
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
