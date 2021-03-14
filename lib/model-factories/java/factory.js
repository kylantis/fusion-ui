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
const pathLib = require('path');
const fs = require('fs');
const shelljs = require('shelljs');

const {
  basePkg,
  baseComponentClassName,
  pkgName,
  targetLanguageFactory,
} = require('./qt-target-language-java');

const jarBuilder = require('../java/jar-builder');
const utils = require('../../utils');

class ModelFactory {

  static cleanupSourceFiles = false;

  static getEmptyClassContents(className, packageName) {
    return `
    package ${packageName};
    public abstract class ${className} {
      protected ${className}(String id) {}
    }`;
  }

  static async getSharedClasses() {
    const { getBuildFolder, getEmptyClassContents } = ModelFactory;

    const classesDir = pathLib.join(
      getBuildFolder(),
      ...basePkg.split('.'),
    );
    if (!fs.existsSync(classesDir)) {
      fs.mkdirSync(classesDir, { recursive: true });
    }

    const files = [];

    // Add BaseComponent .java file
    const baseComponentFile = pathLib.join(classesDir, `${baseComponentClassName}.java`);
    if (!fs.existsSync(baseComponentFile)) {
      fs.writeFileSync(
        baseComponentFile,
        getEmptyClassContents(baseComponentClassName, basePkg)
      );
    }
    files.push(baseComponentFile);


    // Add Enum java files
    const enumClassesDir = pathLib.join(classesDir, 'enums');

    if (fs.existsSync(enumClassesDir)) {
      fs.rmSync(enumClassesDir, { recursive: true, force: true })
    }

    fs.mkdirSync(enumClassesDir, { recursive: true });

    const enumsFile = pathLib
      .join(
        process.env.PWD, 'src', 'components', 'enums.json'
      )

    if (!fs.existsSync(enumsFile)) {
      return files;
    }

    const enums = JSON.parse(fs.readFileSync(enumsFile))

    const rootDefName = utils.generateRandomString(6);

    const schema = {
      $schema: 'http://json-schema.org/draft-06/schema#',
      $ref: `#/definitions/${rootDefName}`,
      definitions: {},
    };

    for (const key in enums) {
      const className = utils.getAlias(key);

      schema.definitions[className] = {
        enum: enums[key]
      }
    }

    const rootDefProperties = {};
    Object.keys(schema.definitions).forEach(className => {
      rootDefProperties[utils.generateRandomString(6)] = {
        $ref: `#/definitions/${className}`,
      }
    })

    schema.definitions[rootDefName] = {
      type: 'object',
      additionalProperties: false,
      required: Object.keys(rootDefProperties),
      title: rootDefName,
      properties: rootDefProperties,
    }

    const schemaInput = new JSONSchemaInput(new JSONSchemaStore());
    await schemaInput.addSource({ name: rootDefName, schema: JSON.stringify(schema) });

    const inputData = new InputData();
    inputData.addInput(schemaInput);

    const result = await quicktypeMultiFile({
      inputData,
      lang: new (targetLanguageFactory({
        packageName: `${basePkg}.enums`
      }))(),
    });

    result.forEach((value, key) => {

      if (key.toLowerCase() == `${rootDefName.toLowerCase()}.java`) {
        // Ignore the "mock" root definition we created above
        return;
      }

      const file = pathLib.join(enumClassesDir, key);
      fs.writeFileSync(file, value.lines.join('\n'));

      files.push(file);
    })

    return files;
  }

  static getEnumClassesDir() {
    return pathLib.join(
      process.env.PWD, 'dist', 'enums'
    );
  }

  static getComponentClassPaths({ preprocessor, componentRefs }) {

    const { getComponentClasspath } = ModelFactory;

    return [
      ...componentRefs
        .filter(c => c !== baseComponentClassName)
        .map(c => getComponentClasspath({
          preprocessor,
          className: c,
        })),
    ];
  }

  static getComponentClasspath({ preprocessor, className }) {
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

  static getRefList({ mapper, componentTypes, enumTypes }) {
    const { getRefList0 } = ModelFactory;
    return [
      getRefList0(componentTypes),
      getRefList0(enumTypes),
    ];
  }

  static getRefList0(obj) {
    const result = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const [className, list] of Object.entries(obj)) {
      list.forEach((refName) => {
        if (!result.includes(refName)) {
          result.push(refName);
        }
      });
    }
    return [...new Set(result)];
  }

  static async quicktypeJSONSchema({
    preprocessor, schema, componentTypes, enumTypes
  }) {
    const {
      cleanupSourceFiles, getModelsPath, getSharedClasses,
      getRefList, getComponentClassPaths,
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
      lang: new (targetLanguageFactory({
        preprocessor, componentTypes, enumTypes, generic: false,
        packageName: `${pkgName}.${preprocessor.assetId}`
      }))(),
    };
    const dir = getModelsPath({ assetId: preprocessor.assetId });
    const sources = [];

    return await quicktypeMultiFile(cfg)
      .then((m) => {
        const [componentRefs, enumRefs] = getRefList({
          componentTypes, enumTypes
        });

        m.forEach((value, key) => {

          const className = key.replace('.java', '');

          if (
            // We are mapping to lowercase because it's possible
            // that the component class name on the client-side
            // is different from that the server-side equivalent.
            // It's safe to assume that we just never know what the
            // final class names will end up to be

            componentRefs.map(ref => ref.toLowerCase())
              .includes(className.toLowerCase()) ||

            enumRefs.map(ref => ref.toLowerCase())
              .includes(className.toLowerCase())
          ) {
            return;
          }
          const src = pathLib.join(dir, key);

          sources.push(src);

          fs.writeFileSync(src, value.lines.join('\n'));
        });

        return componentRefs;
      })
      .then(async (componentRefs) => {
        const cp = getComponentClassPaths({
          preprocessor, componentRefs
        });

        // Compile java sources
        const cmd = [
          'javac',
          ...cp.length ? ['-classpath', cp.join(':')] : [],
          ...await getSharedClasses(),
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

  static createModels({
    preprocessor, schema, componentTypes, enumTypes
  }) {
    const { quicktypeJSONSchema } = ModelFactory;

    return quicktypeJSONSchema({
      preprocessor,
      schema: JSON.stringify(schema),
      componentTypes, enumTypes
    });
  }
}

module.exports = ModelFactory;
