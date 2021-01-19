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
  baseComponentPkg,
  baseComponentClassName,
  pkgName,
  create: targetLanguageFactory,
} = require('./qt-target-language-java');

const jarBuilder = require('../java/jar-builder');

class ModelFactory {

  static cleanupSourceFiles = false;

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
          public abstract class ${baseComponentClassName} {
            protected ${baseComponentClassName}(String id) {}
          }`,
      );
    }

    return file;
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

  static getComponentList(componentTypes) {
    const result = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const [className, list] of Object.entries(componentTypes)) {
      list.forEach((ref) => {
        if (!result.includes(ref)) {
          result.push(ref);
        }
      });
    }
    return result;
  }

  static async quicktypeJSONSchema({
    preprocessor, schema, componentTypes
  }) {
    const {
      cleanupSourceFiles,
      getModelsPath, getBaseComponentSrcFile, getComponentList, getCp,
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
        targetLanguageFactory({ preprocessor, componentTypes })
      )(),
    };
    const dir = getModelsPath({ assetId: preprocessor.assetId });
    const sources = [];
    
    return await quicktypeMultiFile(cfg)
      .then((m) => {
        const refList = getComponentList(componentTypes);

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
        const cp = refList
          .filter(ref => ref !== baseComponentClassName)
          .map(ref => getCp({
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

  static createModels({
    preprocessor, schema, componentTypes
  }) {
    const { quicktypeJSONSchema } = ModelFactory;

    return quicktypeJSONSchema({
      preprocessor,
      schema: JSON.stringify(schema),
      componentTypes,
    });
  }
}

module.exports = ModelFactory;
