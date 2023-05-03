/* eslint-disable no-underscore-dangle */
const assert = require('assert');
const pathLib = require('path');
const fs = require('fs');
const lodash = require('lodash');
const {
  JavaRenderer, JavaTargetLanguage, getOptionValues, javaOptions
} = require('quicktype-core');
const { defined, } = require('quicktype-core/dist/support/Support');
const { AcronymStyleOptions } = require('quicktype-core/dist/support/Acronyms');
const {
  utf16ConcatMap, escapeNonPrintableMapper, isAscii, standardUnicodeHexEscape
} = require('quicktype-core/dist/support/Strings');

const { getAlias, generateRandomString, peek } = require('../../utils');
const PathResolver = require('../../path-resolver');
const SchemaGenerator = require('../../schema-generator');

const { APP_ID } = process.env;

const basePkg = 'com.re.paas.api.fusion';
const baseComponentClassName = 'BaseComponent';
const dataNodeClassName = 'DataNode';

const pkgName = `${basePkg}.components.${APP_ID}`;

const noOpClassName = generateRandomString(6);
const dataNodeClassNamePrefix = 'Remote';
class FusionJavaRenderer extends JavaRenderer {

  static defferedImportsMarker = "<<DEFERRED_IMPORTS>>";

  emitClassAttributes(classType, className) {
    super.emitClassAttributes(classType, className);
    // this.emitLine('@ThisIsMySuperCustomAnnotation');
  }

  // eslint-disable-next-line class-methods-use-this
  makeNamedTypeNamer() {
    return this.getNameStyling('typeNamingFunction');
  }

  static mergeNames(name) {
    switch (true) {
      case typeof name == 'string':
        return name;

      case name.constructor.name == 'Array':
        return name.map(mergeNames).join('');

      case name.constructor.name == 'SimpleName':
        return Array.from(name._unstyledNames)[0];

      default:
        throw Error(`Unknown name: ${name}`)
    }
  }

  getEnumClasses() {
    const { schema } = this.preprocessor;
    return Object
      .entries(schema.definitions)
      .filter(([k, { isEnumRef }]) => !!isEnumRef)
      .map(([k]) => this.classNamer(k))
  }

  getSharedEnumClasses() {
    const { schema } = this.preprocessor;
    return Object
      .entries(schema.definitions)
      .filter(([k, { isEnumRef, originalName }]) => !!isEnumRef && !!originalName)
      .map(([k]) => this.classNamer(k))
  }

  getSharedComponentClasses() {
    const { schema } = this.preprocessor;
    return Object
      .entries(schema.definitions)
      .filter(([k, { isComponent }]) => !!isComponent)
      .map(([k]) => this.classNamer(k))
  }

  classNamer(className) {
    return this.makeNamedTypeNamer().nameStyle(className);
  }

  toFqEnumClassName(n) {
    return `${pkgName}.shared.enums.${this.classNamer(n)}`;
  }

  toFqComponentClassName(n) {
    return `${pkgName}.${this.preprocessor.getAssetIdFromClassName(n)
      }.${this.classNamer(n)}`;
  }

  emitSourceStructure() {

    const sourceStructues = [];

    this.forEachNamedType(
      "leading-and-interposing",
      (c, n) => sourceStructues.push({ type: 'class', c, n }),
      (c, n) => sourceStructues.push({ type: 'enum', c, n }),
      (c, n) => sourceStructues.push({ type: 'union', c, n }),
    );

    sourceStructues.reverse();

    sourceStructues.forEach(({ type, c, n }) => {
      switch (type) {
        case 'class':
          this.emitClassDefinitions(c, n)
          break;
        case 'enum':
          this.emitEnumDefinition(c, n)
          break;
        case 'union':
          this.emitUnionDefinition(c, n)
          break;
      }
    });
  }

  emitClassDefinitions(c, n) {

    const typeName = this.sourcelikeToString(n);

    if (typeName == this.classNamer(noOpClassName)) {
      return;
    }

    const isComponentRef = this.getSharedComponentClasses().includes(typeName);
    const isEnumRef = this.getSharedEnumClasses().includes(typeName);

    if (isComponentRef || isEnumRef) {
      return;
    }

    const { schema, metadata: { isAbstract } } = this.preprocessor;
    const className = Array.from(n._unstyledNames)[0];

    // Write the main class
    this.emitMainClassDefinition(c, n);

    const isEnum = schema.definitions[className].isEnumRef;

    if (!isAbstract && !isEnum) {

      // Write the respective DataNode class
      this.emitRemoteClassDefinition(c, n);
    }
  }

  getCollectionConfig(path) {
    return this.preprocessor.resolver.config.collections[path];
  }

  getScalarConfig(path) {
    return this.preprocessor.resolver.config.scalars[path];
  }

  // Todo: Support more java primitive types in map key type
  getMapKeyType(path) {
    const { keyTypeConfigProperty } = PathResolver;
    const literalTypes = ['string', 'number', 'boolean'];

    const { [keyTypeConfigProperty]: keyType = 'String' } = this.getCollectionConfig(path);

    return literalTypes.includes(keyType.toLowerCase())
      ? keyType.charAt(0).toUpperCase() + keyType.slice(1)
      : SchemaGenerator.getClassName(keyType);
  }

  static visitCollectionGenericTypes0(typeName, fn) {
    const { visitCollectionGenericTypes0 } = FusionJavaRenderer;
    if (!typeName || !Array.isArray(typeName)) {
      return;
    }
    fn(typeName);
    visitCollectionGenericTypes0(typeName[1], fn);
  }

  static isListType(t) {
    return Array.isArray(t) && t[0] == 'List<';
  }

  static isMapType(t) {
    return Array.isArray(t) && t[0].startsWith('Map<');
  }

  static visitCollectionGenericTypes(path, typeName, fn) {
    const { visitCollectionGenericTypes0, isListType, isMapType } = FusionJavaRenderer;
    let p = path;

    visitCollectionGenericTypes0(typeName, (t) => {
      const isList = isListType(t);
      const isMap = isMapType(t);

      assert(isList || isMap);

      fn(p, t);

      p = `${p}${isList ? '_$' : '.$_'}`
    });
  }

  getPaths(c) {
    const paths = {};

    this.forEachClassProperty(c, 'none', (name, jsonName, p) => {
      const path = this.getPathFromPropertyDescription(this.descriptionForClassProperty(c, jsonName));
      paths[path] = this.javaType(false, p.type);
    });

    return paths;
  }

  getPathFromPropertyDescription(description) {
    // Note: If this is a shared type, path at index 0 is what we likely need
    return this.getPathsFromPropertyDescription(description)[0];
  }

  getPathsFromPropertyDescription(description) {
    return this.getPathArrayFromDescription(
      this.sourcelikeToString(description)
    );
  }

  getPathArrayFromDescription(description) {
    let { path } = JSON.parse(typeof description == 'string' ? description : peek(description));
    return typeof path == 'string' ? [path] : path;
  }

  getFieldSetterComment(path) {
    const { comment } = this.getScalarConfig(path) || {};

    if (comment && comment.java && Array.isArray(comment.java.setter)) {
      return comment.java.setter;
    }
  }

  getFieldGetterComment(path) {
    const { comment } = this.getScalarConfig(path) || {};

    if (comment && comment.java && Array.isArray(comment.java.getter)) {
      return comment.java.getter;
    }
  }

  getFieldSetterCastExpression(fieldType, variable, getterExpr) {
    switch (fieldType) {
      case 'Date':
        return `String ${variable} = this.toDateString(${getterExpr});`;
      default:
        return null;
    }
  }

  getFieldGetterCastExpression(fieldType, variable, getterExpr) {
    switch (fieldType) {
      case 'Date':
        return `${fieldType} ${variable} = this.fromDateString((String) ${getterExpr});`;
      case 'float':
      case 'double':
      case 'short':
      case 'long':
      case 'int':
        return `${fieldType} ${variable} = ((Number) ${getterExpr}).${fieldType}Value();`;
      default:
        return null;
    }
  }

  getCustomFieldType(typeName, config) {
    const { float, double, short, long, date } = config;
    const isNumber = typeName == 'int';

    switch (true) {
      case isNumber && float:
        typeName = 'float';
        break;
      case isNumber && double:
        typeName = 'double';
        break;
      case isNumber && short:
        typeName = 'short';
        break;
      case isNumber && long == true:
        typeName = 'long';
        break;
      case typeName == 'String' && date:
        typeName = 'Date';
        break;
    }

    return typeName;
  }

  getFieldType(description, p) {
    const { visitCollectionGenericTypes, isMapType } = FusionJavaRenderer;

    let typeName = this.javaType(false, p.type);
    const path = this.getPathFromPropertyDescription(description);

    assert(typeName);

    if (typeName == 'double') {
      typeName = 'int';
    }

    switch (true) {
      case Array.isArray(typeName):
        // If this is a map, change the first generic type from 'String' to whatever keyType
        // is configured for this map
        visitCollectionGenericTypes(
          path,
          typeName,
          (p, t) => {
            if (isMapType(t)) {
              t[0] = `Map<${this.classNamer(this.getMapKeyType(p))}, `;
            }
          });
        break;

      default:
        typeName = this.getCustomFieldType(typeName, this.getScalarConfig(path) || {});
    }

    return typeName;
  }

  getCollectionTypeMetadata(path, typeName) {
    const {
      visitCollectionGenericTypes, isListType, isMapType, isEnumMapKey
    } = FusionJavaRenderer;

    let hasList = false;
    let hasMap = false;
    let genericValueType;
    let referencedEnums = [];

    visitCollectionGenericTypes(path, typeName, (p, t) => {

      const isList = isListType(t);
      const isMap = isMapType(t);

      if (isList) {
        hasList = true;
      }

      if (isMap) {
        hasMap = true;

        const keyType = t[0].replace('Map<', '').replace(', ', '');

        if (isEnumMapKey(keyType)) {
          referencedEnums.push(keyType)
        }
      }

      assert(!genericValueType);

      if (!Array.isArray(t[1])) {
        genericValueType = this.sourcelikeToString(t[1]);
      }

      if (t != typeName) {

        if (!this.getPathsInfo()[p]) {

          this.getPathsInfo()[p] = {
            typeName: this.sourcelikeToString(t),
            collectionMetadata: this.getCollectionTypeMetadata(p, t)
          };
        }
      }
    });

    assert(genericValueType);

    return { hasList, hasMap, genericValueType, referencedEnums };
  }

  static isEnumMapKey(keyType) {
    return !['String', 'Number', 'Boolean'].includes(keyType);
  }

  getAssociatedEnumTypes(p, t) {
    const { visitCollectionGenericTypes, isMapType, isEnumMapKey } = FusionJavaRenderer;

    const arr = [];

    visitCollectionGenericTypes(p, t, (path, typeName) => {
      if (!isMapType(typeName)) {
        return;
      }

      const keyType = this.getMapKeyType(path);

      if (isEnumMapKey(keyType)) {
        arr.push(keyType)
      }
    });

    return arr;
  }

  getEnumImports(className, c) {
    const { isMapType } = FusionJavaRenderer;

    let enumImports = this.enumTypes[className] || [];

    // Add enum imports from map keys
    Object.entries(this.getPaths(c))
      .filter(([p, t]) => isMapType(t))
      .forEach(([p, t]) => {
        enumImports = enumImports.concat(this.getAssociatedEnumTypes(p, t));
      });

    return [...new Set(enumImports)]
      .map(n => this.toFqEnumClassName(n));
  }

  isPathEmittable(path) {
    return !this.preprocessor.resolver
      .isClientOnly(typeof path == 'string' ? path : path[0]);
  }

  getFieldAccessModifier(path) {
    const allowed = ['public', 'private', 'protected', 'default'];

    // let { visibility = 'public' } = get_from_some_config

    // if (visibility == 'default') {
    //   visibility = '';
    // } else if (!allowed.includes(visibility)) {
    //   throw Error(`Unknown value provided for "visibility", path="${path}", allowedValues=${allowed}`);
    // }

    return allowed[0];
  }

  emitMainClassDefinition(c, simpleName) {

    const { defferedImportsMarker, isListType, isMapType } = FusionJavaRenderer;

    const randomClass = 'java.util.Random';
    const consumerClass = 'java.util.function.Consumer';

    let imports = [...this.importsForType(c), ...this.importsForClass(c)];

    const className = Array.from(simpleName._unstyledNames)[0];
    const typeName = this.sourcelikeToString(simpleName);

    const isComponentClass = className === this.preprocessor.className;

    const description = this.descriptionForType(c);

    if (!isComponentClass) {
      const path = this.getPathArrayFromDescription(description);

      path.forEach(p => {

        const pathInfo = this.getPathsInfo()[p];

        if (pathInfo) {
          assert(pathInfo.typeName == typeName);
          return;
        }

        this.getPathsInfo()[p] = { typeName };
      });
    }

    const { assetId, component, metadata: { parents: [parent], isAbstract } } = this.preprocessor;

    const behaviours = component.getOwnBehaviours();
    const events = component.getOwnEvents()

    // Add necessary imports needed by fields 
    this.forEachClassProperty(c, 'none', (name, jsonName, p) => {

      const arrayListClass = 'java.util.ArrayList';
      const hashMapClass = 'java.util.HashMap';

      const description = this.descriptionForClassProperty(c, jsonName);
      const fieldType = this.getFieldType(description, p);

      const classImport = () => {
        switch (true) {
          case isListType(fieldType):
            return [arrayListClass];

          case isMapType(fieldType):
            return [hashMapClass];

          default:
            const i = this.getClassImportForTypeName(fieldType);
            return i ? [i] : [];
        }
      }

      classImport()
        .forEach(i => {
          if (!imports.includes(i)) {
            imports.push(i);
          }
        });
    });

    if (isComponentClass) {

      imports.push(randomClass);

      if (events.length) {
        imports.push(consumerClass);
      }
    }

    const componentImports = [
      ...new Set(this.componentTypes[className] || [])
    ];

    if (componentImports.includes(baseComponentClassName)) {
      imports.push(`${basePkg}.${baseComponentClassName}`);
      componentImports.splice(componentImports.indexOf(baseComponentClassName), 1);
    }

    if (isComponentClass) {
      if (parent == null) {
        imports.push(`${basePkg}.${baseComponentClassName}`);
      } else {
        componentImports.push(parent);
      }
    }

    imports = [...new Set([
      ...imports,
      ...componentImports
        .map((n) => this.toFqComponentClassName(n)),
      ...this.getEnumImports(className, c),
    ])];

    this.registerImports(imports);

    this.emitFileHeader(simpleName, imports);

    if (isComponentClass) {
      this.defferedImports = [];

      this._emitContext._emitted.push(defferedImportsMarker);
    }

    this.emitLine();
    // this.emitDescription(description);

    // These are functions that need to run after this file is finished. It is currently used for
    // writing event classes
    const finalizers = [];

    this.emitBlock([
      'public', isAbstract ? ' abstract' : '', ' class ', simpleName,
      isComponentClass ? ` extends ${parent == null ? baseComponentClassName : this.classNamer(parent)}` : ''
    ], () => {

      this.ensureBlankLine();

      if (isComponentClass) {
        this.emitLine('private static Random random = new Random();');

        this.emitBlock(['public ', typeName, '(String id)'], () => {
          this.emitLine(`super(id);`);
        });

        if (!isAbstract) {
          this.emitBlock(['public ', typeName, '()'], () => {
            this.emitLine(`super("${assetId}_" + random.nextInt(Integer.MAX_VALUE));`);
          });
        }
      }

      this.forEachClassProperty(c, 'none', (name, jsonName, p) => {

        const description = this.descriptionForClassProperty(c, jsonName);
        const fieldType = this.getFieldType(description, p);

        const paths = this.getPathsFromPropertyDescription(description);

        (() => {
          // Add to pathsInfo
          paths.forEach(path => {

            const pathInfo = this.getPathsInfo()[path];

            const typeName = this.sourcelikeToString(fieldType);

            if (pathInfo) {
              assert(pathInfo.typeName == typeName);
              return;
            }

            this.getPathsInfo()[path] = {
              typeName,
              collectionMetadata: Array.isArray(fieldType) ?
                this.getCollectionTypeMetadata(path, fieldType) : undefined
            };
          })
        })()

        const [path] = paths;

        const isEmittable = this.isPathEmittable(path);

        if (!isEmittable) {
          return;
        }

        let initialValue = '';
        // If type is a collection, initialize eagerly

        switch (p.type.kind) {
          case 'array':
            initialValue = ' = new ArrayList<>()'
            break;
          case 'map':
            initialValue = ' = new HashMap<>()'
            break;
        }

        this.emitLine('private ', fieldType, ' ', name, `${initialValue};`);
      });

      this.forEachClassProperty(c, 'leading-and-interposing', (name, jsonName, p) => {

        const description = this.descriptionForClassProperty(c, jsonName)
        // this.emitDescription(description);

        const path = this.getPathFromPropertyDescription(description);
        const isEmittable = this.isPathEmittable(path);

        if (!isEmittable) {
          return;
        }

        const accessModifier = this.getFieldAccessModifier(path);
        const fieldType = this.getFieldType(description, p);

        let [getterName, setterName] = defined(
          this._gettersAndSettersForPropertyName.get(name),
        );

        // Getter for boolean attributes should be is..., not get...
        if (p.type.kind == 'bool') {
          getterName = lodash.camelCase(`is_${jsonName}`);
        }

        const setterComment = this.getFieldSetterComment(path);
        const getterComment = this.getFieldGetterComment(path);

        if (getterComment) {
          this.emitDescriptionBlock(getterComment);
        }

        this.emitBlock(['public ', fieldType, ' ', getterName, '()'], () => {
          this.emitLine('return ', name, ';');
        });

        this.ensureBlankLine();

        if (setterComment) {
          this.emitDescriptionBlock(setterComment);
        }

        this.emitBlock([`${accessModifier} `, `${typeName} `, setterName, '(', fieldType, ' value)'], () => {
          this.emitLine('this.', name, ' = value;');
          this.emitLine('return this;');
        });

        if (Array.isArray(fieldType)) {

          // If this is a collection-based field, add extra methods to help developers with fluency

          const isList = isListType(fieldType);
          const isMap = isMapType(fieldType);

          assert(isList || isMap);
          assert(fieldType[2] == '>');

          let singularType = fieldType[1];

          // We may not be able to use the singularType in the add...() and remove...() method names because the
          // singularType may not be intrinsic to the collection, for example: an enum array for a shared enum
          const singularClause = jsonName.charAt(0).toUpperCase() + jsonName.slice(1).replace(/s$/g, '').replace(/ie$/g, 'y');

          switch (true) {

            case isList:

              this.ensureBlankLine();
              this.emitBlock(['public ', `${typeName} `, `add${singularClause}`, '(', singularType, ' value)'], () => {
                this.emitLine('this.', getterName, '().add(value);');
                this.emitLine('return this;');
              });
              this.ensureBlankLine();
              this.emitBlock(['public ', `${typeName} `, `remove${singularClause}`, '(', singularType, ' value)'], () => {
                this.emitLine('this.', getterName, '().remove(value);');
                this.emitLine('return this;');
              });
              break;

            case isMap:

              // Todo: Use regex instead
              const keyType = fieldType[0].replace('Map<', '').replace(', ', '')

              this.ensureBlankLine();
              this.emitBlock(['public ', `${typeName} `, `add${singularClause}`, '(', keyType, ' name, ', singularType, ' value)'], () => {
                this.emitLine('this.', getterName, '().put(name, value);');
                this.emitLine('return this;');
              });
              this.ensureBlankLine();
              this.emitBlock(['public ', `${typeName} `, `remove${singularClause}`, '(', keyType, ' name)'], () => {
                this.emitLine('this.', getterName, '().remove(name);');
                this.emitLine('return this;');
              });
              break;
          }
        }
      });

      if (isComponentClass) {

        if (!isAbstract) {
          this.ensureBlankLine();

          this.emitBlock(['public String getAssetId()'], () => {
            this.emitLine('return "', assetId, '";');
          });
        }

        // Add behavior methods
        behaviours.forEach(behaviourName => {
          if (typeof component[behaviourName] != 'function') {
            throw Error(`[${typeName}] Unknown behaviour: ${behaviourName}`);
          }

          this.ensureBlankLine();
          this.emitBehaviourMethod(typeName, imports, behaviourName);
        });

        // Add event methods
        events.forEach(eventName => {
          this.ensureBlankLine();

          finalizers.push(this.emitEventMethod(typeName, imports, eventName));
        });

        this.addDefferedImports();
      }

    });
    this.finishFile();

    finalizers.forEach(fn => fn())

    if (isComponentClass) {
      fs.writeFileSync(
        pathLib.join(
          process.env.PWD, 'dist', 'components', assetId, '.mainClass',
        ),
        `${this.packageName}.${typeName}`,
      )
    }
  }

  emitRemoteClassDefinition(c, simpleName) {

    const { assetId } = this.preprocessor;

    const className = Array.from(simpleName._unstyledNames)[0];

    const parentName = this.sourcelikeToString(simpleName);
    const typeName = `${dataNodeClassNamePrefix}${parentName}`;

    const isComponentClass = className === this.preprocessor.className;

    const description = this.descriptionForType(c);

    if (!isComponentClass) {
      const path = this.getPathArrayFromDescription(description);

      if (!this.isPathEmittable(path)) {
        return;
      }
    }

    let imports = [...this.importsForType(c), ...this.importsForClass(c)];

    // Add necessary imports needed by fields 
    this.forEachClassProperty(c, 'none', (name, jsonName, p) => {

      const description = this.descriptionForClassProperty(c, jsonName);
      const fieldType = this.getFieldType(description, p);

      const classImport = () => {
        const i = this.getClassImportForTypeName(fieldType);
        return i ? [i] : [];
      }

      classImport()
        .forEach(i => {
          if (!imports.includes(i)) {
            imports.push(i);
          }
        });
    });

    const componentImports = [
      ...new Set(this.componentTypes[className] || [])
    ];

    if (componentImports.includes(baseComponentClassName)) {
      imports.push(`${basePkg}.${baseComponentClassName}`);
      componentImports.splice(componentImports.indexOf(baseComponentClassName), 1);
    }

    imports.push(`${basePkg}.${dataNodeClassName}`);

    imports = [...new Set([
      ...imports,
      ...componentImports
        .map((n) => this.toFqComponentClassName(n)),
      ...this.getEnumImports(className, c),
    ])];

    this.emitFileHeader(typeName, imports);

    // this.emitDescription(description);

    this.emitBlock([
      'public', ' class ', typeName, ' extends ', parentName, ' implements ', dataNodeClassName
    ], () => {

      this.ensureBlankLine();
      this.emitLine(`private final String path;`);
      this.emitLine(`private final String sessionId;`);
      this.ensureBlankLine();

      if (isComponentClass) {
        this.emitBlock(['public ', typeName, '(String sessionId, String id)'], () => {
          this.emitLine(`super(id);`);
          this.emitLine(`this.sessionId = sessionId;`);
          this.emitLine(`this.path = null;`);
        });
      } else {
        this.emitBlock(['public ', typeName, '(String sessionId, String path)'], () => {
          this.emitLine(`this.sessionId = sessionId;`);
          this.emitLine(`this.path = path;`);
        });

        this.ensureBlankLine();

        this.emitLine('@Override');
        this.emitBlock(['public String getAssetId()'], () => {
          this.emitLine('return "', assetId, '";');
        });
      }

      this.ensureBlankLine();

      this.emitLine('@Override');
      this.emitBlock(['public String getPath()'], () => {
        this.emitLine(`return this.path;`);
      });

      this.ensureBlankLine();

      this.emitLine('@Override');
      this.emitBlock(['public String getSessionId()'], () => {
        this.emitLine(`return this.sessionId;`);
      });

      this.ensureBlankLine();

      this.emitLine('@Override');
      this.emitBlock(['public String getClassName(String type)'], () => {
        this.emitLine(`return "${dataNodeClassNamePrefix}" + type;`);
      });

      this.forEachClassProperty(c, 'leading-and-interposing', (name, jsonName, p) => {
        const description = this.descriptionForClassProperty(c, jsonName)
        // this.emitDescription(description);

        const path = this.getPathFromPropertyDescription(description);
        const isEmittable = this.isPathEmittable(path);

        if (!isEmittable) {
          return;
        }

        const fieldType = this.getFieldType(description, p);

        let [getterName, setterName] = defined(
          this._gettersAndSettersForPropertyName.get(name),
        );

        // Getter for boolean attributes should be is..., not get...
        if (p.type.kind == 'bool') {
          getterName = lodash.camelCase(`is_${jsonName}`);
        }

        const setterComment = this.getFieldSetterComment(path);
        const getterComment = this.getFieldGetterComment(path);

        this.emitLine('@Override');
        this.emitBlock(['public ', fieldType, ' ', getterName, '()'], () => {

          const variable = 'value';

          switch (true) {
            case this.getEnumClasses().includes(this.sourcelikeToString(fieldType)):
              this.emitLine(fieldType, ' value = ', fieldType, '.forValue((String) this.getProperty("', name, '"));');
              break;

            default:
              if (getterComment) {
                this.emitDescriptionBlock(getterComment);
              }
              this.emitLine(`@SuppressWarnings("unchecked")`);

              const getterExpr = `this.getProperty("${jsonName}")`;
              const expr = this.getFieldGetterCastExpression(fieldType, variable, getterExpr);

              if (expr) {
                this.emitLine(expr);
              } else {
                this.emitLine(fieldType, ` ${variable} = (`, fieldType, ') ', getterExpr, ';');
              }
              break;
          }

          this.emitLine(`return ${variable};`);
        });

        this.ensureBlankLine();

        if (setterComment) {
          this.emitDescriptionBlock(setterComment);
        }
        this.emitLine('@Override');
        this.emitBlock([`public ${typeName} `, setterName, '(', fieldType, ' value)'], () => {

          let variable = 'value';

          const expr = this.getFieldSetterCastExpression(fieldType, `${variable}0`, variable);

          if (expr) {
            this.emitLine(expr);
            variable = `${variable}0`;
          }

          this.emitLine(`this.setProperty("`, name, `", ${variable});`);

          this.emitLine('return this;');
        });

      });

    });
    this.finishFile();
  }

  getClassImportForTypeName(typeName) {
    switch (typeName) {
      case 'Date':
        return 'java.util.Date';
      default:
        return null
    }
  }

  emitEnumDefinition(e, enumName) {

    const stringEscape = utf16ConcatMap(escapeNonPrintableMapper(isAscii, standardUnicodeHexEscape));
    const imports = [];

    this.emitFileHeader(enumName, imports);

    // this.emitDescription(description);

    const caseNames = [];
    this.forEachEnumCase(e, "none", (name, jsonName) => {
      if (caseNames.length > 0)
        caseNames.push(", ");
      caseNames.push(name);
      caseNames.push(`("${stringEscape(jsonName)}")`);
    });
    caseNames.push(";");

    this.emitBlock(["public enum ", enumName], () => {
      this.emitLine(caseNames);

      this.ensureBlankLine();
      this.emitLine(`private final String value;`);

      this.emitBlock(['private ', enumName, '(String value)'], () => {
        this.emitLine(`this.value = value;`);
      });
      this.ensureBlankLine();

      this.emitBlock(['public String getValue()'], () => {
        this.emitLine(`return value;`);
      });
      this.ensureBlankLine();

      this.emitBlock(["public static ", enumName, " forValue(String value)"], () => {
        this.forEachEnumCase(e, "none", (name, jsonName) => {
          this.emitLine('if (value.equals("', stringEscape(jsonName), '")) return ', name, ";");
        });
        this.emitLine('throw new RuntimeException("Cannot deserialize ', enumName, '");');
      });
    });

    this.finishFile();
  }

  registerImports(imports) {
    const allImports = this.allImports || (this.allImports = {});

    imports.forEach((fqClassName) => {
      const className = peek(fqClassName.split('.'));
      if (!allImports[className]) {
        allImports[className] = fqClassName;
      } else {
        assert(allImports[className] == fqClassName);
      }
    });
  }

  getPathsInfo() {
    return this.pathsInfo || (this.pathsInfo = {});
  }

  static getReservedBehaviourNames() {
    return ['on', 'once', 'invokeBehaviour'];
  }

  addDefferedImports() {
    const { defferedImportsMarker } = FusionJavaRenderer;

    const idx = this._emitContext._emitted.indexOf(defferedImportsMarker);
    assert(idx >= 0);
    
    this._emitContext._emitted.splice(
      idx, 1, ...this.defferedImports.length ? this.defferedImports.map(i => `import ${i};`).join('\n') : ''
    );
  }

  getParametersSignature(parameters) {
    const parametersSignature = {};
    const imports = [];

    if (parameters) {
      const parameterEntries = Object.entries(parameters);

      parameterEntries.forEach(([k, v], i) => {
        assert(k);

        const throwUnknownType = () => { throw Error(`Unknown type was specified for parameter name "${k}"`); }

        const addImportForClassName = (className) => {
          const fqClassName = this.allImports[className];
          if (fqClassName) {
            imports.push(fqClassName);
          }
        }

        if (v && v.type) {

          const { type } = v;

          if (typeof type == 'string') {
            switch (type.toLowerCase()) {
              case 'string':
                parametersSignature[k] = this.getCustomFieldType('String', v);
                break;
              case 'number':
                parametersSignature[k] = this.getCustomFieldType('int', v);
                break;
              case 'boolean':
                parametersSignature[k] = 'Boolean';
                break;
              default:
                throwUnknownType();
            }

            const i = this.getClassImportForTypeName(parametersSignature[k]);

            if (i) {
              imports.push(i);
            }

          } else if (type && typeof type == 'object') {
            const { $ref } = type;

            const pathInfo = this.getPathsInfo()[$ref];

            if (!pathInfo) {
              throwUnknownType();
            }

            const { typeName, collectionMetadata } = pathInfo;
            parametersSignature[k] = typeName;

            if (collectionMetadata) {
              const { hasList, hasMap, genericValueType, referencedEnums } = collectionMetadata;

              if (hasList) {
                addImportForClassName('List');
              }
              if (hasMap) {
                addImportForClassName('Map');
              }

              addImportForClassName(genericValueType);

              referencedEnums.forEach(e => addImportForClassName(e))

            } else {
              addImportForClassName(typeName)
            }
          } else {
            throwUnknownType();
          }

          if (i == parameterEntries.length - 1 && v.spread) {
            parametersSignature[k] += '...';
          }

        } else {
          throwUnknownType();
        }
      })
    }

    return { parametersSignature, imports };
  }

  emitBehaviourMethod(typeName, _imports, behaviourName) {

    const { getReservedBehaviourNames } = FusionJavaRenderer;

    if (getReservedBehaviourNames().includes(behaviourName)) {
      throw Error(`Reserved behaviour name "${behaviourName}"`);
    }

    const { config: { behaviours = {} } } = this.preprocessor.resolver;
    let { parameters } = behaviours[behaviourName] || {};

    const { parametersSignature, imports } = this.getParametersSignature(parameters);

    imports
      .filter(i => !_imports.includes(i) && !this.defferedImports.includes(i))
      .forEach(i => {
        this.defferedImports.push(i);
      })

    const parametersString = Object.entries(parametersSignature)
      .map(([k, v]) => `${v} ${k}`).join(', ');
    const parameterNames = Object.keys(parametersSignature).join(', ');

    this.emitBlock(
      [`public ${typeName} ${behaviourName}(${parametersString})`],
      () => {
        this.emitLine(
          `this.invokeBehaviour("${behaviourName}"${parameterNames ? `, ${parameterNames}` : ''});`
        );
        this.emitLine('return this;');
      });
  }

  emitEventMethod(typeName, _imports, eventName) {

    const { config: { events = {} } } = this.preprocessor.resolver;
    let { parameters } = events[eventName] || {};

    const { parametersSignature, imports } = this.getParametersSignature(parameters);

    imports
      .filter(i => !_imports.includes(i) && !this.defferedImports.includes(i))
      .forEach(i => {
        this.defferedImports.push(i);
      })

    const parametersString = Object.entries(parametersSignature)
      .map(([k, v]) => `${v} ${k}`).join(', ');
    const parameterNames = Object.keys(parametersSignature).join(', ');

    const eventNameAlias = getAlias(eventName)
    const eventClassName = `${eventNameAlias}EventListener`;

    const classProducer = () => {
      this.emitFileHeader(eventClassName, imports);

      this.emitLine('@FunctionalInterface');
      this.emitBlock(['public interface ', eventClassName], () => {
        this.ensureBlankLine();

        this.emitLine(`void fn(${parametersString});`);

        this.ensureBlankLine();
      });

      this.finishFile();
    }

    const getConsumerMethodName = `get${eventNameAlias}EventConsumer`;

    const emitConsumerGetterMethod = () => {

      this.emitBlock([`private static Consumer<Object[]> ${getConsumerMethodName}(${eventClassName} listener)`], () => {

        this.emitLine('@SuppressWarnings("unchecked")');
        this.emitBlock(['Consumer<Object[]> consumer = (params) -> '], () => {
          this.ensureBlankLine();

          Object.entries(parametersSignature).forEach(([k, v], i) => {
            if (v.endsWith('...')) {
              v = v.replace('...', '[]');
            }

            this.emitLine(`${v} ${k} = (${v}) params[${i}];`);
          });

          this.ensureBlankLine();
          this.emitLine(`listener.fn(${parameterNames});`);
        });

        this._emitContext.pushItem(';');

        this.ensureBlankLine();
        this.emitLine(`return consumer;`);
      });
    }

    this.ensureBlankLine();
    emitConsumerGetterMethod();


    this.ensureBlankLine();
    this.emitBlock([`public ${typeName} on${eventNameAlias}(${eventClassName} listener)`], () => {

      this.emitLine(`super.on("${eventName}", ${getConsumerMethodName}(listener));`);
      this.emitLine(`return this;`);
    });


    this.ensureBlankLine();
    this.emitBlock([`public ${typeName} on${eventNameAlias}Once(${eventClassName} listener)`], () => {

      this.emitLine(`super.once("${eventName}", ${getConsumerMethodName}(listener));`);
      this.emitLine(`return this;`);
    });

    this.ensureBlankLine();
    this.emitBlock([`public ${typeName} dispatch${eventNameAlias}Event(String eventName${parametersString ? `, ${parametersString}` : ''})`], () => {

      this.emitLine(`super.dispatch("${eventName}", new Object[]{${parameterNames}});`);
      this.emitLine(`return this;`);
    });

    return classProducer;
  }
}

module.exports = {
  baseComponentClassName,
  dataNodeClassName,
  basePkg,
  pkgName,
  attributeProducers: [],
  noOpClassName,
  targetLanguageFactory: ({
    preprocessor, componentTypes, enumTypes, packageName,
  } = {}) => class JacksonJavaTargetLanguage extends JavaTargetLanguage {
      constructor() {
        super('Java', ['java'], 'java');
      }

      makeRenderer(renderContext, untypedOptionValues) {
        const options = getOptionValues(
          javaOptions,
          untypedOptionValues,
        );

        const rendererOptions = {
          ...options,
          ...{
            useList: true,
            lombok: false,
            lombokCopyAnnotations: false,
            dateTimeProvider: 'java8',
            acronymStyle: AcronymStyleOptions.Camel,
          },
          packageName
        };

        const renderer = new FusionJavaRenderer(
          this, renderContext, rendererOptions,
        );
        renderer.preprocessor = preprocessor;

        renderer.componentTypes = componentTypes;
        renderer.enumTypes = enumTypes;

        renderer.packageName = packageName;

        return renderer;
      }
    },
};
