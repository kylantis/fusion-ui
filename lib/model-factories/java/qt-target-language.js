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

const basePkg = 'com.kylantis.apps.api.fusion.client.components';
const componentsBasePkg = `${basePkg}`;

const baseComponentClassName = 'BaseComponent';
const recordNodeClassName = 'RecordNode';
const fieldGetHandleClassName = 'FieldGetHandle';
const fieldSetHandleClassName = 'FieldSetHandle';
const fieldInfoClassName = 'FieldInfo';
const remoteResourceClassName = 'RemoteResource';
const remoteScriptResourceClassName = 'RemoteScriptResource';
const screenTargetClassName = 'ScreenTarget';
const enumClassName = 'Enum';
const rpcContextClassName = 'RpcContext';

const pkgName = `${componentsBasePkg}.${APP_ID}`;

const noOpClassName = generateRandomString(6);

class FusionJavaRenderer extends JavaRenderer {

  #mainClassDeferredImports = [];
  #rpcClassDeferredImports = [];

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

  getReferencedComponentClasses() {
    const { schema } = this.preprocessor;
    return Object
      .entries(schema.definitions)
      .filter(([k, { isComponentRef }]) => !!isComponentRef)
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
    const { assetId } = this.preprocessor;

    this.forEachNamedType(
      "leading-and-interposing",
      (c, n) => sourceStructues.push({ type: 'class', c, n }),
      (c, n) => sourceStructues.push({ type: 'enum', c, n }),
      (c, n) => sourceStructues.push({ type: 'union', c, n }),
    );

    sourceStructues.reverse();

    const classesMetadata = {};

    sourceStructues.forEach(({ type, c, n }) => {

      try {
        const typeName = this.sourcelikeToString(n);
        const metadataObject = {};

        switch (type) {
          case 'class':
            this.emitClassDefinitions(c, n, metadataObject)
            break;
          case 'enum':
            this.emitEnumDefinition(c, n)
            break;
          case 'union':
            this.emitUnionDefinition(c, n)
            break;
        }

        if (!Object.keys(metadataObject).length) {
          classesMetadata[typeName] = metadataObject;
        }
      } catch (e) {
        const { className, logger } = this.preprocessor;
        logger.error(`[${className}] Error occured while generating ${type} "${this.sourcelikeToString(n)}"`);
        throw e;
      }
    });

    const dir = pathLib.join(process.env.PWD, 'dist', 'components', assetId, 'model_factory_metadata', 'java');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(
      pathLib.join(dir, 'classesMetadata.json'),
      JSON.stringify(classesMetadata),
    )
  }

  emitClassDefinitions(c, n, metadataObject) {
    const typeName = this.sourcelikeToString(n);

    if (typeName == this.classNamer(noOpClassName)) {
      return;
    }

    const isComponentRef = this.getReferencedComponentClasses().includes(typeName);
    const isEnumRef = this.getSharedEnumClasses().includes(typeName);

    if (isComponentRef || isEnumRef) {
      return;
    }

    // Write the main class
    this.emitMainClassDefinition(c, n, metadataObject);
  }

  getCollectionConfig(path) {
    return this.preprocessor.resolver.config.collections[path];
  }

  getScalarConfig(path) {
    return this.preprocessor.resolver.config.scalars[path];
  }

  #javaPrimitiveTypeToWrapperType(typeName) {
    switch (typeName) {
      case 'int':
        return 'Integer';
      case 'short':
      case 'long':
      case 'float':
      case 'double':
      case 'boolean':
        return typeName.charAt(0).toUpperCase() + typeName.slice(1);
      default:
        return typeName;
    }
  }

  // Todo: Support more java primitive types in map key type
  getMapKeyType(path) {
    const { keyTypeConfigProperty } = PathResolver;
    const literalTypes = ['string', 'number', 'boolean'];

    const { [keyTypeConfigProperty]: keyType = 'String' } = this.getCollectionConfig(path);

    return literalTypes.includes(keyType.toLowerCase())
      ? keyType.charAt(0).toUpperCase() + keyType.slice(1)
      : SchemaGenerator.getClassNameForKey(keyType);
  }

  cloneType(type) {
    switch (true) {
      case typeof type == 'string':
        return type;
      case Array.isArray(type):
        return type.map(t => this.cloneType(t));
      default:
        return this.sourcelikeToString(type);
    }
  }

  static visitCollectionGenericTypes0(type, collConsumer, typeConsumer) {
    const { visitCollectionGenericTypes0 } = FusionJavaRenderer;

    if (Array.isArray(type)) {

      if (collConsumer) {
        collConsumer(type);
      }

      if (!Array.isArray(type[1]) && typeConsumer) {
        typeConsumer(type);
      }

      visitCollectionGenericTypes0(type[1], collConsumer);
    }
  }

  static isListType(t) {
    return Array.isArray(t) && t[0] == 'List<';
  }

  static isMapType(t) {
    return Array.isArray(t) && t[0].startsWith('Map<');
  }

  static visitCollectionGenericTypes(path, typeName, collConsumer, typeConsumer) {
    const { visitCollectionGenericTypes0, isListType, isMapType } = FusionJavaRenderer;
    let p = path;

    visitCollectionGenericTypes0(
      typeName,
      (t) => {
        const isList = isListType(t);
        const isMap = isMapType(t);

        assert(isList || isMap);

        if (collConsumer) {
          collConsumer(p, t);
        }

        p = `${p}${isList ? '_$' : '.$_'}`
      },
      (t) => {
        if (typeConsumer) {
          typeConsumer(p, t);
        }
      }
    );
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

  isScalarType(path) {
    const { pathRefs } = this.preprocessor.schema;
    return !pathRefs[path];
  }

  isRefType(path) {
    const { pathRefs } = this.preprocessor.schema;
    return !!pathRefs[path];
  }

  #isQtNumberType(t) {
    return ['double', 'Double'].includes(t);
  }

  #addToPathsInfo(p, t) {
    const pathsInfo = this.getPathsInfo();

    if (!pathsInfo[p]) {
      pathsInfo[p] = {
        type: t,
        typeName: this.sourcelikeToString(t),
      };
    }
  }

  getFieldType(description, p) {
    const { visitCollectionGenericTypes, isMapType } = FusionJavaRenderer;

    const pathsInfo = this.getPathsInfo();

    let type = this.javaType(false, p.type);
    assert(type);

    const paths = this.getPathsFromPropertyDescription(description);
    const [path] = paths;

    if (!pathsInfo[path]) {
      switch (true) {
        case Array.isArray(type):
          // If this is a map, change the first generic type from 'String' to whatever keyType
          // is configured for this map
          visitCollectionGenericTypes(
            path,
            type,
            (p, t) => {
              if (isMapType(t)) {
                t[0] = `Map<${this.classNamer(this.getMapKeyType(p))}, `;
              }

              this.#addToPathsInfo(p, t);
            },
            (p, t) => {
              if (this.isScalarType(p)) {
                t[1] = this.#javaPrimitiveTypeToWrapperType(
                  this.getCustomFieldType(this.#isQtNumberType(t[1]) ? 'int' : t[1], this.getScalarConfig(p))
                );
              }
            });
          break;

        case this.isScalarType(path):
          type = this.getCustomFieldType(this.#isQtNumberType(type) ? 'int' : type, this.getScalarConfig(path));
          break;
      }

      paths.forEach(p => {
        this.#addToPathsInfo(p, type);
      });
    }

    return pathsInfo[path];
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

  emitMainClassDefinition(c, simpleName, metadataObject) {
    const { isListType, isMapType } = FusionJavaRenderer;

    let imports = [...this.importsForType(c), ...this.importsForClass(c)];

    const className = Array.from(simpleName._unstyledNames)[0];
    const typeName = this.sourcelikeToString(simpleName);

    const isComponentClass = className === this.preprocessor.className;

    const description = this.descriptionForType(c);

    if (!isComponentClass) {
      this.getPathArrayFromDescription(description)
        .forEach(p => {
          this.#addToPathsInfo(p, typeName);
        });
    }

    const { assetId, metadata: { parents, isAbstract } } = this.preprocessor;
    const [parent] = parents;

    const COLLECTION_CLASS = 'java.util.Collection';
    const LIST_CLASS = 'java.util.List';
    const MAP_CLASS = 'java.util.Map';

    // Add necessary imports needed by fields 
    this.forEachClassProperty(c, 'none', (name, jsonName, p) => {

      const description = this.descriptionForClassProperty(c, jsonName);
      const { type, typeName } = this.getFieldType(description, p);

      const classImport = () => {
        switch (true) {
          case isListType(type):
            return [LIST_CLASS];

          case isMapType(type):
            return [MAP_CLASS];

          default:
            const i = this.getFqClassName(typeName);
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

    const componentImports = [
      ...new Set(this.componentTypes[className] || [])
    ];

    if (isComponentClass) {
      if (parent == null) {
        imports.push(`${basePkg}.${baseComponentClassName}`);
      } else {
        componentImports.push(parent);
      }

      imports.push(`${basePkg}.${remoteResourceClassName}`);
      imports.push(`${basePkg}.${remoteScriptResourceClassName}`);

    } else {
      imports.push(`${basePkg}.${recordNodeClassName}`);
    }

    imports.push(`${basePkg}.${fieldInfoClassName}`);
    imports.push(`${basePkg}.${fieldGetHandleClassName}`);
    imports.push(`${basePkg}.${fieldSetHandleClassName}`);

    imports = [...new Set([
      ...imports,
      ...componentImports
        .map((n) => this.toFqComponentClassName(n)),
      ...this.getEnumImports(className, c),
    ])];

    this.registerTypes([
      COLLECTION_CLASS, LIST_CLASS, MAP_CLASS, ...imports,
    ]);

    this.emitFileHeader(simpleName, imports);

    metadataObject.imports = imports;

    const defferedImportsMarker = "<<main_class_deferred_imports>>";

    if (isComponentClass) {
      this._emitContext._emitted.push(defferedImportsMarker);
      this.emitLine();
    }

    // this.emitDescription(description);

    const parentsConfig = parents.map(p => this.preprocessor.getNonNullConfig(p));

    const hasGenericSuperclass = !parent || parentsConfig[0].isAbstract;
    const isAbstractComponent = isComponentClass && isAbstract

    this.emitBlock([
      'public', isAbstractComponent ? ' abstract' : '', ' class ', typeName, isAbstractComponent ? `<T extends ${typeName}<T>>` : '',
      isComponentClass ? ` extends ${!parent ? baseComponentClassName : this.classNamer(parent)}${hasGenericSuperclass ? `<${isAbstract ? 'T' : typeName}>` : ''}` : '',
      isComponentClass ? '' : ` extends ${recordNodeClassName}<${typeName}>`,
    ], () => {

      if (isComponentClass) {
        this.ensureBlankLine();
        this.emitBlock(['public ', typeName, '()'], () => {
          this.emitLine('this(null);');
        });
      }

      this.ensureBlankLine();
      this.emitBlock(['public ', typeName, isComponentClass ? '(String ref)' : '()'], () => {
        if (isComponentClass) {
          this.emitLine('super(ref);');
        }

        this.forEachClassProperty(c, 'none', (name, jsonName, p) => {

          const description = this.descriptionForClassProperty(c, jsonName);
          const { type } = this.getFieldType(description, p);

          const path = this.getPathFromPropertyDescription(description);;

          const isEmittable = this.isPathEmittable(path);

          if (!isEmittable) return;

          const key = peek(path.split('.'));
          const genericFieldType = this.#javaPrimitiveTypeToWrapperType(
            this.sourcelikeToString(type)
          );

          this.emitLine(`super.addField(new ${fieldInfoClassName}<${genericFieldType}>("${key}", "${path}"));`);
        });
      });
      this.ensureBlankLine();

      metadataObject.setters = {};

      this.forEachClassProperty(c, 'leading-and-interposing', (name, jsonName, p) => {

        const description = this.descriptionForClassProperty(c, jsonName)
        // this.emitDescription(description);

        const path = this.getPathFromPropertyDescription(description);
        const isEmittable = this.isPathEmittable(path);

        if (!isEmittable) {
          return;
        }

        const { type: fieldType } = this.getPathsInfo()[path];
        const accessModifier = this.getFieldAccessModifier(path);

        let [getterName, setterName] = defined(
          this._gettersAndSettersForPropertyName.get(name),
        );

        // Getter for boolean attributes should be is..., not get...
        if (p.type.kind == 'bool') {
          getterName = lodash.camelCase(`is_${jsonName}`);
        }

        const key = peek(path.split('.'));

        const genericFieldType = this.#javaPrimitiveTypeToWrapperType(
          this.sourcelikeToString(fieldType)
        );

        this.emitBlock(['public ', fieldType, ' ', getterName, '()'], () => {
          this.emitLine(`return super.getFieldValue(new ${fieldGetHandleClassName}<${genericFieldType}>("${key}"));`);
        });

        this.ensureBlankLine();

        if (isAbstractComponent) {
          this.emitLine(`@SuppressWarnings("unchecked")`);
        }
        this.emitBlock([`${accessModifier} `, `${isAbstractComponent ? 'T' : typeName} `, setterName, '(', fieldType, ` ${key})`], () => {
          this.emitLine(`super.setFieldValue(new ${fieldSetHandleClassName}<${genericFieldType}>("${key}", ${key}));`);
          this.emitLine('return ', isAbstractComponent ? '(T) ' : '', 'this;');
        });

        metadataObject.setters[this.sourcelikeToString(setterName)] = {
          paramType: fieldType,
          paramName: key,
          returnType: typeName,
        };
      });

      if (!isComponentClass || !isAbstract) {
        this.ensureBlankLine();
        this.emitBlock(['public String getAssetId()'], () => {
          this.emitLine('return "', assetId, '";');
        });
      }

      if (isComponentClass) {
        const serverEvents = this.preprocessor.getServerEvents();

        // Add event listener methods

        serverEvents.forEach(evtName => {
          this.emitEventMethod(evtName);
        });


        // Add events signature method

        this.addMainClassDefferedImport(MAP_CLASS, imports);
        this.addMainClassDefferedImport('java.util.HashMap', imports);

        this.ensureBlankLine();
        this.emitBlock(
          [`public static Map<String, Class[]> getEventsSignature()`],
          () => {
            this.emitLine(
              `var map = new HashMap<String, Class[]>(${serverEvents.length});`
            );

            this.ensureBlankLine();
            serverEvents.forEach(evt => {
              this.emitEventSignature(evt, imports);
            });
            this.ensureBlankLine();

            this.emitLine('return map;');
          });

        this.addDefferedImportsToEmitContext(defferedImportsMarker, this.#mainClassDeferredImports);
      }

    });
    this.finishFile();

    if (isComponentClass) {
      this.emitRpcClass();

      fs.writeFileSync(
        pathLib.join(
          process.env.PWD, 'dist', 'components', assetId, '.mainClass',
        ),
        `${this.packageName}.${typeName}`,
      )
    }
  }

  getFqClassName(typeName) {
    switch (typeName) {
      case 'String':
        return 'java.lang.String';
      case 'Date':
        return 'java.util.Date';
      case 'float':
      case 'Float':
        return 'java.lang.Float';
      case 'double':
      case 'Double':
        return 'java.lang.Double';
      case 'short':
      case 'Short':
        return 'java.lang.Short';
      case 'long':
      case 'Long':
        return 'java.lang.Long';
      case 'int':
      case 'Integer':
        return 'java.lang.Integer';
      case 'Boolean':
        return 'java.lang.Boolean';
    }

    if (this.typesMap && this.typesMap[typeName]) {
      return this.typesMap[typeName];
    }

    if (
      this.getReferencedComponentClasses().includes(typeName) ||
      typeName == this.preprocessor.getDeclaredBaseComponent()
    ) {
      return this.toFqComponentClassName(typeName);
    }

    return null;
  }

  emitEnumDefinition(e, enumName) {

    const stringEscape = utf16ConcatMap(escapeNonPrintableMapper(isAscii, standardUnicodeHexEscape));
    const imports = [
      `${basePkg}.${enumClassName}`
    ];

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

    this.emitBlock(["public enum ", enumName, ' implements ', enumClassName], () => {
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

  registerTypes(types) {
    const typesMap = this.typesMap || (this.typesMap = {});

    types.forEach((fqClassName) => {
      const className = peek(fqClassName.split('.'));
      if (!typesMap[className]) {
        typesMap[className] = fqClassName;
      } else {
        assert(typesMap[className] == fqClassName);
      }
    });
  }

  getPathsInfo() {
    return this.pathsInfo || (this.pathsInfo = {});
  }

  static getReservedBehaviourNames() {
    return ['invokeBehaviour'];
  }

  addDefferedImportsToEmitContext(defferedImportsMarker, defferedImports) {
    const idx = this._emitContext._emitted.indexOf(defferedImportsMarker);
    assert(idx >= 0);

    this._emitContext._emitted.splice(
      idx, 1, ...defferedImports.length ? defferedImports.map(i => `import ${i};`).join('\n') : ''
    );
  }

  addRpcClassDefferedImport(fqClassName, _imports) {
    if (_imports && _imports.includes(fqClassName)) {
      return;
    }

    if (!this.#rpcClassDeferredImports.includes(fqClassName)) {
      this.#rpcClassDeferredImports.push(fqClassName);
    }
  }

  addMainClassDefferedImport(fqClassName, _imports) {
    if (_imports && _imports.includes(fqClassName)) {
      return;
    }

    if (!this.#mainClassDeferredImports.includes(fqClassName)) {
      this.#mainClassDeferredImports.push(fqClassName);
    }
  }

  getParametersSignature(parameters, useFqClassName, fqTransform) {
    const { visitCollectionGenericTypes } = FusionJavaRenderer;
    const { componentRefType } = PathResolver;

    const parametersSignature = {};
    let imports = [];

    if (parameters) {
      const parameterEntries = Object.entries(parameters);

      parameterEntries.forEach(([k, v], i) => {
        assert(k);

        const throwUnknownType = () => { throw Error(`Unknown type was specified for parameter name "${k}"`); }

        const toFqClassName = (className, generic) => {
          let fqClassName = this.getFqClassName(className);

          if (fqClassName) {
            imports.push(fqClassName);
          } else {
            fqClassName = `${this.packageName}.${className}`;
          }

          return useFqClassName ? fqTransform(fqClassName, generic) : className;
        }

        if (v && v.type) {
          const { type } = v;

          if (typeof type == 'string') {

            const className = (() => {
              switch (true) {
                case type.toLowerCase() == 'string':
                  return this.getCustomFieldType('String', v);
                case type.toLowerCase() == 'number':
                  return this.getCustomFieldType('int', v);
                case type.toLowerCase() == 'boolean':
                  return 'Boolean';
                case type == componentRefType:
                  return this.preprocessor.getDeclaredBaseComponent();
                default:
                  throwUnknownType();
              }
            })();

            parametersSignature[k] = toFqClassName(className);

          } else if (type && typeof type == 'object') {
            const { $ref } = type;

            const pathInfo = this.getPathsInfo()[$ref];

            if (!pathInfo) {
              throwUnknownType();
            }

            parametersSignature[k] = (() => {
              const { type, typeName } = pathInfo;

              if (Array.isArray(type)) {
                const _type = this.cloneType(type);

                visitCollectionGenericTypes(
                  $ref, _type,
                  (p, t) => {
                    const [type, keyPart] = t[0].split('<');
                    const fqType = this.getFqClassName(type);

                    imports.push(fqType);

                    if (type == 'Map') {
                      const keyType = keyPart.replace(', ', '');
                      const fqKeyType = this.getFqClassName(keyType);

                      imports.push(fqKeyType);
                      t[0] = `${type}<${useFqClassName ? fqTransform(fqKeyType, true) : keyType}, `;
                    }

                    if (useFqClassName) {
                      t[0] = t[0].replace(/^\w+(?=<)/g, fqTransform(fqType, t != _type));
                    }
                  },
                  (p, t) => {
                    const typeName = this.sourcelikeToString(t[1]);
                    t[1] = toFqClassName(typeName, true);
                  });

                return this.sourcelikeToString(_type);

              } else {
                return toFqClassName(typeName, true);
              }
            })();
          } else {
            throwUnknownType();
          }

          if (i == parameterEntries.length - 1 && v.spread) {
            const v = parametersSignature[k];
            parametersSignature[k] = useFqClassName ? `${v}[]` : `${v}...`;
          }

        } else {
          throwUnknownType();
        }
      })
    }

    // java automatically imports java.lang
    imports = imports.filter(i => !i.startsWith('java.lang'));

    return { parametersSignature, imports, };
  }

  emitRpcClass() {
    const { component, className, metadata: { parents } } = this.preprocessor;
    const [parent] = parents;

    const imports = [`${basePkg}.${rpcContextClassName}`];

    if (parent) {
      imports.push(`${this.toFqComponentClassName(parent)}Rpc`);
    }

    const rpcClassName = `${className}Rpc`;

    this.emitFileHeader(rpcClassName, imports);

    const defferedImportsMarker = "<<rpc_class_deferred_imports>>";

    this._emitContext._emitted.push(defferedImportsMarker);

    this.ensureBlankLine();
    this.emitBlock([
      'public class ', rpcClassName,
      parent ? ` extends ${this.classNamer(parent)}Rpc` : ''
    ], () => {

      this.emitLine(`private final ${rpcContextClassName} context;`);

      this.ensureBlankLine();
      this.emitBlock(['public ', rpcClassName, `(${rpcContextClassName} context)`], () => {
        if (parent) {
          this.emitLine(`super(context);`);
        }
        this.emitLine(`this.context = context;`);
      });

      component.getBehaviours()
        .forEach(behaviourName => {
          const _className = this.preprocessor.component.getBehaviourOwner(behaviourName);
          let behaviourConfig;
          let assetId;

          if (_className != this.preprocessor.className) {
            if (_className != baseComponentClassName) {
              // this behaviour is inherited from a parent component, we will be sublassing the RPC class so return...
              return;
            }
          } else {
            const { config: { behaviours = {} } } = this.preprocessor.resolver;

            behaviourConfig = behaviours[behaviourName];
            assetId = this.preprocessor.assetId;
          }

          this.ensureBlankLine();
          this.emitBehaviourMethod(rpcClassName, assetId, parent, behaviourName, behaviourConfig);
        });
    });

    this.addDefferedImportsToEmitContext(defferedImportsMarker, this.#rpcClassDeferredImports);

    this.finishFile();
  }

  emitBehaviourMethod(rpcClassName, assetId, parent, behaviourName, behaviourConfig) {
    const { getReservedBehaviourNames } = FusionJavaRenderer;

    if (getReservedBehaviourNames().includes(behaviourName)) {
      throw Error(`Reserved behaviour name "${behaviourName}"`);
    }

    const { parameters } = behaviourConfig || {};

    const { parametersSignature, imports } = this.getParametersSignature(parameters);

    imports
      .forEach(i => {
        this.addRpcClassDefferedImport(i);
      })

    const parametersString = Object.entries(parametersSignature)
      .map(([k, v]) => `${v} ${k}`).join(', ');
    const parameterNames = Object.keys(parametersSignature).join(', ');

    if (assetId || !parent) {
      this.emitBlock(
        [`public final ${rpcClassName} ${behaviourName}(${parametersString})`],
        () => {
          this.emitLine(
            `context.invokeBehaviour(${assetId ? `"${assetId}"` : null}, "${behaviourName}"${parameterNames ? `, ${parameterNames}` : ''});`
          );
          this.emitLine('return this;');
        });
    }
  }

  emitEventMethod(eventName) {
    const { className } = this.preprocessor;
    const eventNameAlias = getAlias(eventName);

    const { config: { events = {} } } = this.preprocessor.resolver;
    const { parameters } = events[eventName] || { clientOnly: false };

    const { parametersSignature } = this.getParametersSignature(
      parameters, true,
      (clazz, generic) => `{@link ${clazz}}`
    );

    this.ensureBlankLine();

    const parameterEntries = Object.entries(parametersSignature);

    this.emitDescriptionBlock([
      `Event Name: ${eventName}<br>`,
      `Listener Signature: (${parameterEntries.map(([k, v]) => `${v.replace('<', '&lt;').replace('>', '&gt;')} ${k}`).join(', ')})<br><br>`,
      `@param handler The uri of the event listener to handle the "${eventName}" event`,
    ]);

    this.emitLine(`@SuppressWarnings("unchecked")`);
    this.emitBlock([`public final <U extends ${className}> U on${eventNameAlias}(String handler)`], () => {
      this.emitLine(`return (U) super.addEventListener("${eventName}", handler);`);
    });
  }

  emitEventSignature(eventName, _imports) {
    const { config: { events = {} } } = this.preprocessor.resolver;
    const { parameters, clientOnly } = events[eventName] || { clientOnly: false };

    if (clientOnly) return;

    const { parametersSignature, imports } = this.getParametersSignature(parameters);

    imports
      .filter(i => !_imports.includes(i))
      .forEach(i => {
        this.addMainClassDefferedImport(i);
      })

    const classList = Object.values(parametersSignature)
      .map(t => {
        if (t.includes('<')) {
          t = t.split('<')[0];
        }
        if (t.endsWith('...')) {
          t = t.replace('...', '[]');
        }
        return `${t}.class`;
      })

    this.emitLine(`map.put("${eventName}", ${classList.length ? `new Class[]{${classList.join(', ')}}` : 'null'});`);
  }
}

module.exports = {
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
  appId: APP_ID,
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
