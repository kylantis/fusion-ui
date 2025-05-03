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
  recordNodeClassName,
  fieldGetHandleClassName,
  fieldSetHandleClassName,
  fieldInfoClassName,
  remoteResourceClassName,
  remoteScriptResourceClassName,
  screenTargetClassName,
  enumClassName,
  rpcContextClassName,
  pkgName,
  attributeProducers,
  noOpClassName,
  targetLanguageFactory,
} = require('./qt-target-language');

const jarBuilder = require('../java/jar-builder');
const utils = require('../../utils');

const SchemaGenerator = require('../../schema-generator');

class ModelFactory {

  static getSourcesForStubClasses() {
    return {
      [screenTargetClassName]: `
      package ${basePkg};
  
      public enum ${screenTargetClassName} {
	      MOBILE, TABLET, DESKTOP;
      }`,

      [remoteResourceClassName]: `
      package ${basePkg};
  
      import java.util.List;

      public class ${remoteResourceClassName} {
	      public ${remoteResourceClassName}(String url, List<${screenTargetClassName}> screenTargets) {}
      }`,

      [remoteScriptResourceClassName]: `
      package ${basePkg};
  
      import java.util.List;

      public class ${remoteScriptResourceClassName} extends ${remoteResourceClassName} {
	      public ${remoteScriptResourceClassName}(String url, List<${screenTargetClassName}> screenTargets, String namespace) {
          super(url, screenTargets);
        }
        public ${remoteScriptResourceClassName}(String url, List<${screenTargetClassName}> screenTargets) {
          this(url, screenTargets, null);
        }
      }`,

      [enumClassName]: `
      package ${basePkg};
  
      public interface ${enumClassName} {
        public String getValue();
      }`,

      [rpcContextClassName]: `
      package ${basePkg};
  
      public interface ${rpcContextClassName} {
        void invokeBehaviour(String className, String behaviourName, Object...args);
      }`,

      [fieldInfoClassName]: `
      package ${basePkg};
  
      public class ${fieldInfoClassName}<T> {
        public ${fieldInfoClassName}(String key, String path) {}
      }`,

      [fieldGetHandleClassName]: `
      package ${basePkg};
  
      public class ${fieldGetHandleClassName}<T> {
        public ${fieldGetHandleClassName}(String key) {}
      }`,

      [fieldSetHandleClassName]: `
      package ${basePkg};
  
      public class ${fieldSetHandleClassName}<T> {
        public ${fieldSetHandleClassName}(String key, T value) {}
      }`,

      [baseComponentClassName]: `
      package ${basePkg};
  
      import java.util.function.Consumer;
      import java.util.Collection;
  
      public abstract class ${baseComponentClassName}<T extends ${baseComponentClassName}<T>> extends ${recordNodeClassName}<T> {
        protected ${baseComponentClassName}(String ref) {}
        protected final <U extends T> U addEventListener(String eventName, String handler) {return null;}
      }`,

      [recordNodeClassName]: `
      package ${basePkg};
  
      import java.util.Map;
      import java.util.List;
  
      public abstract class ${recordNodeClassName}<T extends ${recordNodeClassName}<T>> {
        public abstract String getAssetId();
        protected final <U> void addField(${fieldInfoClassName}<U> field) {};
        protected final <U> U getFieldValue(${fieldGetHandleClassName}<U> handle) {return null;}
        protected final <U> void setFieldValue(${fieldSetHandleClassName}<U> handle) {};
      }`
    };
  }

  static async getEnumClasses() {
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

    if (!fs.existsSync(enumClassesDir)) {
      fs.mkdirSync(enumClassesDir, { recursive: true });
    }

    const enums = JSON.parse(fs.readFileSync(enumsFile, 'utf-8'))

    const enumClassNames = fs.readdirSync(enumClassesDir);

    Object.keys(enums).forEach((enumName) => {

      const className = `${SchemaGenerator.getClassNameForKey(enumName)}.java`;

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
      const className = SchemaGenerator.getClassNameForKey(key);

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

  static getStubClassesDir() {
    const { getSharedClassesDir } = ModelFactory;
    return getSharedClassesDir(basePkg);
  }

  static getStubClasses() {
    const { getSourcesForStubClasses, getStubClassesDir } = ModelFactory;

    const baseDir = getStubClassesDir();

    return Object.entries(getSourcesForStubClasses())
      .map(([fileName, contents]) => {

        const file = pathLib.join(baseDir, `${fileName}.java`);
        if (!fs.existsSync(file)) {
          fs.writeFileSync(
            file, contents
          );
        }
        return file;
      });
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
    const { getModelsPath, getComponentClassPaths, getStubClasses, getEnumClasses } = ModelFactory;

    const stubClasses = getStubClasses();
    const enumClasses = await getEnumClasses();

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
      '-parameters',
      ...cp.length ? ['-classpath', cp.join(':')] : [],
      ...enumClasses,
      ...stubClasses,
      ...sources,
      '-Xlint:-this-escape'
    ];

    const result = shelljs.exec(cmd.join(' '));

    if (result.code !== 0) {
      throw Error(result.text);
    }

    // // Cleanup stub .java files
    // stubClasses
    //   .forEach((src) => {
    //     fs.rmSync(src);
    //   });
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
