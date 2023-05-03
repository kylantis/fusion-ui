/* eslint-disable no-case-declarations */
/* eslint-disable no-unused-vars */

/* eslint-disable no-return-await */
/* eslint-disable no-param-reassign */
const {
  quicktypeMultiFile,
  InputData,
  JSONSchemaInput,
} = require('quicktype-core');
const pathLib = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const shelljs = require('shelljs');

const {
  basePkg,
  baseComponentClassName,
  dataNodeClassName,
  pkgName,
  attributeProducers,
  noOpClassName,
  targetLanguageFactory,
} = require('./qt-target-language');

const jarBuilder = require('../java/jar-builder');
const utils = require('../../utils');

const SchemaGenerator = require('../../schema-generator');

class ModelFactory {

  static getBaseComponentClass(className, packageName) {
    return `
    package ${packageName};

    import java.util.function.Consumer;

    public abstract class ${className} {
      protected ${className}(String id) {}

      public abstract String getAssetId();
      protected void invokeBehaviour(String name, Object...args) {}
      protected void on(String name, Consumer<Object[]> consumer) {}
      protected void once(String name, Consumer<Object[]> consumer) {}
      protected void dispatch(String name, Object[] params) {}
    }`;
  }

  static getDataNodeClass(className, packageName) {
    const dateClass = 'java.util.Date';

    return `
    package ${packageName};

    import ${dateClass};

    public interface ${className} {
      String getAssetId();
      String getSessionId();
      String getPath();
      String getClassName(String type);
      default Object getProperty(String path) { return null; };
      default void setProperty(String path, Object value) {};
      default String toPropertyString(String path) { return null; };
      
      // Serialization Utility methods
      default String toDateString(Date date) { return null; }
      default Date fromDateString(String dateString) { return null; }
    }`;
  }

  static getBaseComponentSrcFile() {
    const { getBaseComponentClass, getSharedClassesDir } = ModelFactory;
    const baseDir = getSharedClassesDir(basePkg);

    const file = pathLib.join(baseDir, `${baseComponentClassName}.java`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(
        file,
        getBaseComponentClass(baseComponentClassName, basePkg)
      );
    }
    return file;
  }

  static getDataNodeSrcFile() {
    const { getDataNodeClass, getSharedClassesDir } = ModelFactory;
    const baseDir = getSharedClassesDir(basePkg);

    const file = pathLib.join(baseDir, `${dataNodeClassName}.java`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(
        file,
        getDataNodeClass(dataNodeClassName, basePkg)
      );
    }
    return file;
  }

  static async getEnumSrcFiles() {
    const { getEnumClassesDir } = ModelFactory;

    const files = [];
    const enumClassesDir = getEnumClassesDir();

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

      const className = `${SchemaGenerator.getClassName(enumName)}.java`;

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

    const rootDefName = noOpClassName;

    const schema = {
      $schema: 'http://json-schema.org/draft-06/schema#',
      $ref: `#/definitions/${rootDefName}`,
      definitions: {},
    };

    for (const key in enums) {
      const className = SchemaGenerator.getClassName(key);

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

    const schemaInput = new JSONSchemaInput(null);
    schemaInput.addSourceSync({ name: rootDefName, schema: JSON.stringify(schema) })

    inputData.addInput(schemaInput);

    const qtLanguage = new (targetLanguageFactory({
      packageName: `${pkgName}.shared.enums`
    }))();

    const result = await quicktypeMultiFile({
      inputData,
      lang: qtLanguage,
    });

    result.forEach((value, key) => {

      // Note: The "mock" root definition we created above will not be generated
      // because it is == noOpClassName which the renderer skips by default

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

  static getSharedClassesBaseDir() {
    return pathLib.join(
      process.env.PWD,
      'generated',
      'shared',
      'classes',
    );
  }

  static getSharedClassesDir(pkg) {
    const { getSharedClassesBaseDir } = ModelFactory;

    const dir = pathLib.join(
      getSharedClassesBaseDir(),
      ...pkg.split('.'),
    );
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };

  static getEnumClassesDir() {
    const { getSharedClassesDir } = ModelFactory;
    const baseDir = getSharedClassesDir(pkgName);

    return pathLib.join(baseDir, 'shared', 'enums');
  }

  static getStubClasses() {
    const { getBaseComponentSrcFile, getDataNodeSrcFile } = ModelFactory;
    return [
      getBaseComponentSrcFile(),
      getDataNodeSrcFile(),
    ]
  }

  static async getSharedClasses() {
    const { getStubClasses, getEnumSrcFiles } = ModelFactory;
    return [
      ...getStubClasses(),
      ... await getEnumSrcFiles()
    ];
  }

  static getComponentClassPaths({ preprocessor }) {

    const { getComponentClasspath } = ModelFactory;

    return Object.keys(preprocessor.metadata.distComponentList)
      .map(c => getComponentClasspath({
        preprocessor,
        className: c,
      }));
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
    const { getModelsPath, getSharedClasses, getComponentClassPaths, getStubClasses } = ModelFactory;
    const sharedClasses = await getSharedClasses();

    const { className, assetId } = preprocessor;

    const inputData = new InputData();

    const qtLanguage = new (targetLanguageFactory({
      preprocessor, componentTypes, enumTypes,
      packageName: `${pkgName}.${assetId}`,
    }))();

    const schemaInput = new JSONSchemaInput(null, attributeProducers);
    schemaInput.addSourceSync({ name: className, schema });

    inputData.addInput(schemaInput);

    const dir = getModelsPath({ assetId });
    const sources = [];

    const m = await quicktypeMultiFile({
      inputData,
      lang: qtLanguage,
    });

    const filesToWrite = [];

    m.forEach((value, key) => {
      const src = pathLib.join(dir, key);
      sources.push(src);
      filesToWrite.push(
        fsPromises.writeFile(src, value.lines.join('\n'))
      );
    });

    await Promise.all(filesToWrite);

    // Todo: only add component refs
    const cp = getComponentClassPaths({ preprocessor });

    // Compile java sources
    const cmd = [
      'javac',
      ...cp.length ? ['-classpath', cp.join(':')] : [],
      ...sharedClasses,
      ...sources,
      '-Xlint:all',
      '-Xlint:-path'
    ];

    const result = shelljs.exec(cmd.join(' '));

    if (result.code !== 0) {
      throw Error(result.text);
    }

    // Cleanup stub class files
    getStubClasses()
      .forEach((src) => {
        fs.rmSync(src);
        fs.rmSync(src.replace('.java', '.class'));
      });
  }

  static async createModels({
    preprocessor, schema, componentTypes, enumTypes
  }) {
    const { quicktypeJSONSchema } = ModelFactory;

    const schemaString = JSON.stringify(schema);

    return quicktypeJSONSchema({
      preprocessor,
      schema: schemaString,
      componentTypes, enumTypes
    });
  }

  static buildArchive() {
    jarBuilder();
  }
}

module.exports = ModelFactory;
