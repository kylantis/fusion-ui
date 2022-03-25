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
} = require('./qt-target-language');

const jarBuilder = require('../java/jar-builder');
const utils = require('../../utils');

class ModelFactory {

  static cleanupSourceFiles = false;

  static getBaseComponentMock(className, packageName) {
    return `
    package ${packageName};

    import java.util.Map;
    import java.util.function.Consumer;

    public abstract class ${className} {
      protected ${className}(String id) {}

      public abstract String getAssetId();
      protected void invokeBehaviour(String name) {}
      protected void addEventListener(String name, Consumer<Map<String, Object>> consumer) {}
    }`;
  }

  static getBaseComponentSrcFile({ baseDir }) {
    const { getBaseComponentMock } = ModelFactory;
    const file = pathLib.join(baseDir, `${baseComponentClassName}.java`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(
        file,
        getBaseComponentMock(baseComponentClassName, basePkg)
      );
    }
    return file;
  }

  static async getEnumSrcFiles({ baseDir }) {

    const files = [];
    const enumClassesDir = pathLib.join(baseDir, 'enums');

    const enumsFile = pathLib
      .join(
        process.env.PWD, 'src', 'components', 'enums.json'
      )

    if (!fs.existsSync(enumsFile)) {
      // No enums were defined, return empty array
      return files;
    }

    const enumsDistFile = pathLib
      .join(
        process.env.PWD, 'dist', 'components', 'enums.json'
      )

    if (!fs.existsSync(enumsDistFile)) {
      
      // Copy enums.json so that browsers can access it
      fs.copyFileSync(enumsFile, enumsDistFile);
    }

    if (!fs.existsSync(enumClassesDir)) {
      fs.mkdirSync(enumClassesDir, { recursive: true });
    }


    const enums = JSON.parse(fs.readFileSync(enumsFile))

    const enumClassNames = fs.readdirSync(enumClassesDir);

    Object.keys(enums).forEach((enumName) => {

      const className = `${utils.getAlias(enumName)}.java`;

      for (const f of enumClassNames) {
        if (f.toLowerCase() == className.toLowerCase()) {
          const classFile = pathLib.join(enumClassesDir, f);

          files.push(classFile);
          delete enums[enumName];

          break;
        }
      }
    });

    if (!Object.keys(enums).length) {
      return files;
    }

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

    const inputData = new InputData();

    const schemaInput = new JSONSchemaInput(new JSONSchemaStore());
    schemaInput.addSourceSync({ name: rootDefName, schema: JSON.stringify(schema) })

    inputData.addInput(schemaInput);

    const qtLanguage = new (targetLanguageFactory({
      packageName: `${pkgName}.enums`
    }))();

    const result = await quicktypeMultiFile({
      inputData,
      lang: qtLanguage,
    });

    result.forEach((value, key) => {

      if (key.toLowerCase() == `${rootDefName.toLowerCase()}.java`) {
        // Ignore the "mock" root definition we created above
        return;
      }

      const file = pathLib.join(enumClassesDir, key);
      const dir = pathLib.dirname(file);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(file, value.lines.join('\n'));

      files.push(file);
    });

    return files;
  }

  static async getSharedClasses() {
    const {
      getBuildFolder, getBaseComponentSrcFile, getEnumSrcFiles
    } = ModelFactory;

    const getDir = (pkg) => {
      const dir = pathLib.join(
        getBuildFolder(),
        'classes',
        ...pkg.split('.'),
      );
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    };

    return [
      getBaseComponentSrcFile({ baseDir: getDir(basePkg) }),
      ... await getEnumSrcFiles({ baseDir: getDir(pkgName) })
    ];
  }

  static getEnumClassesDir() {
    return pathLib.join(
      process.env.PWD, 'dist', 'enums'
    );
  }

  static getComponentClassPaths({ preprocessor }) {

    const { getComponentClasspath } = ModelFactory;
    const { getComponentList } = preprocessor.constructor;

    return Object.keys(getComponentList())
      .map(c => getComponentClasspath({
        preprocessor,
        className: c,
      }));
  }

  static getComponentClasspath({ preprocessor, className }) {
    const { getAssetIdFromClassName } = preprocessor.constructor;
    const cp = pathLib
      .join(
        process.env.PWD,
        'dist', 'components',
        getAssetIdFromClassName(className),
        'classes',
      );
    return cp;
  }

  static getBuildFolder() {
    const dir = pathLib
      .join(
        process.env.PWD,
        'build',
      );

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * This returns the path where the java files should be written to.
   * This will always return an empty directory.
   */
  static getModelsPath({ assetId }) {
    const modelsFolder = pathLib
      .join(
        process.env.PWD,
        'dist', 'components', assetId, 'classes',
        ...pkgName.split('.'),
        assetId,
      );

    if (fs.existsSync(modelsFolder)) {
      fs.rmSync(modelsFolder, { recursive: true });
    }

    fs.mkdirSync(modelsFolder, { recursive: true });

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
      cleanupSourceFiles, getModelsPath,
      getSharedClasses, getRefList, getComponentClassPaths,
    } = ModelFactory;
    const sharedClasses = await getSharedClasses();

    const { className, assetId } = preprocessor;

    const inputData = new InputData();
    const qtLanguage = new (targetLanguageFactory({
      preprocessor, componentTypes, enumTypes, generic: false,
      packageName: `${pkgName}.${assetId}`
    }))();

    const schemaInput = new JSONSchemaInput(new JSONSchemaStore());
    schemaInput.addSourceSync({ name: className, schema });

    inputData.addInput(schemaInput);

    const dir = getModelsPath({ assetId });
    const sources = [];
    const [componentRefs, enumRefs] = getRefList({
      componentTypes, enumTypes
    });

    const m = await quicktypeMultiFile({
      inputData,
      lang: qtLanguage,
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

    const cp = getComponentClassPaths({ preprocessor });

    // Compile java sources
    const cmd = [
      'javac',
      ...cp.length ? ['-classpath', cp.join(':')] : [],
      ...sharedClasses,
      ...sources,
    ];

    const result = shelljs.exec(cmd.join(' '));

    if (result.code !== 0) {
      throw Error(result.text);
    }

    // If applicable, cleanup component source files
    if (cleanupSourceFiles) {
      sources.forEach((src) => {
        fs.rmSync(src);
      });
    }
  }

  static async createModels({
    preprocessor, schema, componentTypes, enumTypes
  }) {
    const { quicktypeJSONSchema } = ModelFactory;

    return await quicktypeJSONSchema({
      preprocessor,
      schema: JSON.stringify(schema),
      componentTypes, enumTypes
    });
  }

  static buildArchive() {
    jarBuilder();
  }
}

module.exports = ModelFactory;
