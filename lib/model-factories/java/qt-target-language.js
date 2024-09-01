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

const basePkg = 'com.re.paas.api.fusion.components';
const baseComponentClassName = 'BaseComponent';

const recordNodeClassName = 'RecordNode';

const fieldGetHandleClassName = 'FieldGetHandle';
const fieldSetHandleClassName = 'FieldSetHandle';
const behaviorInvokeHandleClassName = 'BehaviorInvokeHandle';
const eventDispatchHandleClassName = 'EventDispatchHandle';
const eventListenerHandleClassName = 'EventListenerHandle';
const functionClassName = 'Function';
const fieldInfoClassName = 'FieldInfo';
const remoteResourceClassName = 'RemoteResource';
const remoteScriptResourceClassName = 'RemoteScriptResource';
const screenTargetClassName = 'ScreenTarget';

const pkgName = `${basePkg}.${APP_ID}`;

const noOpClassName = generateRandomString(6);
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

    this.forEachNamedType(
      "leading-and-interposing",
      (c, n) => sourceStructues.push({ type: 'class', c, n }),
      (c, n) => sourceStructues.push({ type: 'enum', c, n }),
      (c, n) => sourceStructues.push({ type: 'union', c, n }),
    );

    sourceStructues.reverse();

    sourceStructues.forEach(({ type, c, n }) => {
      try {

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

      } catch (e) {
        const { className, logger } = this.preprocessor;
        logger.error(`[${className}] Error occured while generating ${type} "${this.sourcelikeToString(n)}"`);
        throw e;
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

    // Write the main class
    this.emitMainClassDefinition(c, n);
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

  static visitCollectionGenericTypes0(typeName, collConsumer, typeConsumer) {
    const { visitCollectionGenericTypes0 } = FusionJavaRenderer;

    if (Array.isArray(typeName)) {

      if (collConsumer) {
        collConsumer(typeName);
      }

      if (!Array.isArray(typeName[1]) && typeConsumer) {
        typeConsumer(typeName);
      }

      visitCollectionGenericTypes0(typeName[1], collConsumer);
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

  isScalarType(path) {
    const { pathRefs } = this.preprocessor.schema;
    return !pathRefs[path];
  }

  isRefType(path) {
    const { pathRefs } = this.preprocessor.schema;
    return !!pathRefs[path];
  }

  isGenericRefType(path) {
    const { pathRefs, definitions } = this.preprocessor.schema;

    const className = pathRefs[path];

    if (!className) return false;

    if (className == BaseComponent.name) return true;

    const { isRootDefinition, required, isComponentRef, isEnumRef } = definitions[className];

    if ((!isRootDefinition && required.length) || isEnumRef) return false;

    assert(isRootDefinition || isComponentRef);

    const { isAbstract } = this.preprocessor.getNonNullConfig(className);

    return isAbstract;
  }

  #isQtNumberType(t) {
    return ['double', 'Double'].includes(t);
  }

  getFieldType(description, p) {
    const { visitCollectionGenericTypes, isMapType } = FusionJavaRenderer;

    let typeName = this.javaType(false, p.type);
    const path = this.getPathFromPropertyDescription(description);

    assert(typeName);

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
          },
          (p, t) => {
            if (this.isScalarType(p)) {

              t[1] = this.#javaPrimitiveTypeToWrapperType(
                this.getCustomFieldType(this.#isQtNumberType(t[1]) ? 'int' : t[1], this.getScalarConfig(p))
              );

            } else {
              assert(this.isRefType(p));

              if (this.isGenericRefType(p)) {
                t[1] = `${this.sourcelikeToString(t[1])}<?>`;
              }
            }
          });
        break;

      case this.isRefType(path):
        if (this.isGenericRefType(path)) {
          typeName = `${this.sourcelikeToString(typeName)}<?>`;
        }
        break;

      default:
        assert(this.isScalarType(path));

        typeName = this.getCustomFieldType(this.#isQtNumberType(typeName) ? 'int' : typeName, this.getScalarConfig(path));
        break;
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

    const { assetId, component, metadata: { parents, isAbstract } } = this.preprocessor;
    const [parent] = parents;

    const COLLECTION_CLASS = 'java.util.Collection';
    const COLLECTIONS_CLASS = 'java.util.Collections';

    const LIST_CLASS = 'java.util.List';
    const MAP_CLASS = 'java.util.Map';

    // Add necessary imports needed by fields 
    this.forEachClassProperty(c, 'none', (name, jsonName, p) => {

      const description = this.descriptionForClassProperty(c, jsonName);
      const fieldType = this.getFieldType(description, p);

      const classImport = () => {
        switch (true) {
          case isListType(fieldType):
            return [LIST_CLASS];

          case isMapType(fieldType):
            return [MAP_CLASS];

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

    this.registerImports(imports);

    this.emitFileHeader(simpleName, imports);

    if (isComponentClass) {
      this.defferedImports = [];

      this._emitContext._emitted.push(defferedImportsMarker);
      this.emitLine();
    }

    // this.emitDescription(description);

    // These are functions that need to run after this file is finished. It is currently used for
    // writing event classes
    const finalizers = [];

    const parentsConfig = parents.map(p => this.preprocessor.getNonNullConfig(p));

    const hasGenericSuperclass = !parent || parentsConfig[0].isAbstract;
    const isAbstractComponent = isComponentClass && isAbstract

    this.emitBlock([
      'public', isAbstractComponent ? ' abstract' : '', ' class ', typeName, isAbstractComponent ? `<T extends ${typeName}<T>>` : '',
      isComponentClass ? ` extends ${!parent ? baseComponentClassName : this.classNamer(parent)}${hasGenericSuperclass ? `<${isAbstract ? 'T' : typeName}>` : ''}` : '',
      isComponentClass ? '' : ` extends ${recordNodeClassName}<${typeName}>`,
    ], () => {


      this.ensureBlankLine();
      this.emitBlock(['public ', typeName, '()'], () => {

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
          })();

          const [path] = paths;

          const isEmittable = this.isPathEmittable(path);

          if (!isEmittable) {
            return;
          }

          const key = peek(path.split('.'));
          const genericFieldType = this.#javaPrimitiveTypeToWrapperType(
            this.sourcelikeToString(fieldType)
          );

          this.emitLine(`this.addField(new ${fieldInfoClassName}<${genericFieldType}>("${key}"));`);
        });
      });
      this.ensureBlankLine();

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

        const key = peek(path.split('.'));

        const genericFieldType = this.#javaPrimitiveTypeToWrapperType(
          this.sourcelikeToString(fieldType)
        );

        if (getterComment) {
          this.emitDescriptionBlock(getterComment);
        }

        this.emitBlock(['public ', fieldType, ' ', getterName, '()'], () => {
          this.emitLine(`return this.getFieldValue(new ${fieldGetHandleClassName}<${genericFieldType}>("${key}"));`);
        });


        this.ensureBlankLine();

        if (setterComment) {
          this.emitDescriptionBlock(setterComment);
        }

        this.emitBlock([`${accessModifier} `, `${typeName}${isAbstractComponent ? '<T>' : ''} `, setterName, '(', fieldType, ' value)'], () => {
          this.emitLine(`this.setFieldValue(new ${fieldSetHandleClassName}<${genericFieldType}>("${key}", value));`);
          this.emitLine('return this;');
        });
      });

      if (isComponentClass) {
        const { cssDependencies, jsDependencies, renderTree } = this.preprocessor.metadata;

        if (!isAbstract) {
          this.ensureBlankLine();
          this.emitBlock(['public String getAssetId()'], () => {
            this.emitLine('return "', assetId, '";');
          });

          this.ensureBlankLine();
          this.emitBlock(['public String[][] getRenderTree()'], () => {
            const arr = [];

            Object.entries(renderTree)
              .forEach(([assetId, className]) => {
                arr.push(`new String[] {"${assetId}", "${className}"}`);
              });

            this.emitLine('return new String[][] {');
            arr.forEach((e, i) => {
              if (i < arr.length - 1) {
                e += ',';
              }

              this.emitLine(`\t${e}`);
            });
            this.emitLine('};');
          });
        }

        const emitDepsMethod = (resourceClassName, methodName, resources) => {
          this.ensureBlankLine();

          this.emitBlock([`public Collection<${resourceClassName}> ${methodName}()`], () => {

            this.addDefferedImport(COLLECTION_CLASS, imports);
            this.addDefferedImport(LIST_CLASS, imports)

            const arr = [];
            resources.forEach(({ url, screenTargets = [], namespace }) => {

              if (screenTargets.length) {
                this.addDefferedImport(`${basePkg}.${screenTargetClassName}`)
              } else {
                this.addDefferedImport(COLLECTIONS_CLASS)
              }

              const args = [
                `"${url}"`,
                screenTargets.length ?
                  `List.of(${screenTargets.map(target => `${screenTargetClassName}.${target.toUpperCase()}`).join(', ')})` :
                  'Collections.emptyList()'
              ];

              if (namespace) {
                args.push(`"${namespace}"`);
              }

              arr.push(
                `new ${resourceClassName}(${args.join(', ')})`
              )
            });

            if (arr.length) {
              this.emitLine(`var deps = super.${methodName}();`);
              this.emitLine('deps.addAll(List.of(');
              arr.forEach((res, i) => {
                if (i < arr.length - 1) {
                  res += ','
                }
                this.emitLine(`\t${res}`);
              })
              this.emitLine('));');
              this.emitLine('return deps;');
            } else {
              this.emitLine(`return super.${methodName}();`);
            }
          });
        }

        emitDepsMethod(
          remoteResourceClassName, 'getCssDependencies', cssDependencies.own,
        )

        emitDepsMethod(
          remoteScriptResourceClassName, 'getJsDependencies', jsDependencies.own,
        )

        const behaviours = component.getOwnBehaviours();

        const ownEvents = component.getOwnEvents();
        const baseEvents = component.getBaseEvents();

        // Add behavior methods
        behaviours.forEach(behaviourName => {
          if (typeof component[behaviourName] != 'function') {
            throw Error(`[${typeName}] Unknown behaviour: ${behaviourName}`);
          }

          this.ensureBlankLine();
          this.emitBehaviourMethod(imports, behaviourName);
        });

        // Add event methods

        const hasConcreteSuperclassInHierarchy = parentsConfig.filter(({ isAbstract }) => !isAbstract).length;

        if (!isAbstract && !hasConcreteSuperclassInHierarchy) {
          baseEvents.forEach(eventName => {
            this.emitEventMethod(typeName, isAbstract, imports, eventName, null, true);
          });
        }

        ownEvents.forEach(eventName => {
          this.emitEventMethod(typeName, isAbstract, imports, eventName, finalizers);
        });

        this.addDefferedImportsToEmitContext();
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

  addDefferedImportsToEmitContext() {
    const { defferedImportsMarker } = FusionJavaRenderer;

    const idx = this._emitContext._emitted.indexOf(defferedImportsMarker);
    assert(idx >= 0);

    this._emitContext._emitted.splice(
      idx, 1, ...this.defferedImports.length ? this.defferedImports.map(i => `import ${i};`).join('\n') : ''
    );
  }

  addDefferedImport(fqClassName, _imports) {
    if (_imports && _imports.includes(fqClassName)) {
      return;
    }

    if (!this.defferedImports.includes(fqClassName)) {
      this.defferedImports.push(fqClassName);
    }
  }

  getParametersSignature(parameters) {
    const { componentRefType } = PathResolver;

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
            switch (true) {
              case type.toLowerCase() == 'string':
                parametersSignature[k] = this.getCustomFieldType('String', v);
                break;
              case type.toLowerCase() == 'number':
                parametersSignature[k] = this.getCustomFieldType('int', v);
                break;
              case type.toLowerCase() == 'boolean':
                parametersSignature[k] = 'Boolean';
                break;
              case type == componentRefType:
                imports.push(`${basePkg}.${baseComponentClassName}`);
                parametersSignature[k] = `${baseComponentClassName}<?>`;
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

  emitBehaviourMethod(_imports, behaviourName) {

    const { getReservedBehaviourNames } = FusionJavaRenderer;

    if (getReservedBehaviourNames().includes(behaviourName)) {
      throw Error(`Reserved behaviour name "${behaviourName}"`);
    }

    const { config: { behaviours = {} } } = this.preprocessor.resolver;
    let { parameters } = behaviours[behaviourName] || {};

    const { parametersSignature, imports } = this.getParametersSignature(parameters);

    imports
      .filter(i => !_imports.includes(i))
      .forEach(i => {
        this.addDefferedImport(i);
      })

    const parametersString = Object.entries(parametersSignature)
      .map(([k, v]) => `${v} ${k}`).join(', ');
    const parameterNames = Object.keys(parametersSignature).join(', ');

    this.addDefferedImport(`${basePkg}.${behaviorInvokeHandleClassName}`);

    this.emitBlock(
      [`public final void ${behaviourName}(${parametersString})`],
      () => {
        this.emitLine(
          `this.invokeBehaviour(new ${behaviorInvokeHandleClassName}("${behaviourName}"${parameterNames ? `, ${parameterNames}` : ''}));`
        );
      });
  }

  emitEventMethod(typeName, isAbstract, _imports, eventName, finalizers, base) {

    const eventNameAlias = getAlias(eventName);

    const { config: { events = {} } } = this.preprocessor.resolver;
    let { parameters, clientOnly, allowServerDispatch } = events[eventName] || { clientOnly: false };

    if (clientOnly) return;

    const addToImports = (className) => {
      if (!this.defferedImports.includes(className)) {
        this.defferedImports.push(className);
      }
    }

    const emitListenerMethod = (listenerClass, consumerGetter) => {
      this.addDefferedImport(`${basePkg}.${eventListenerHandleClassName}`);
      this.addDefferedImport(listenerClass ? 'java.util.function.Consumer' : `${basePkg}.${functionClassName}`);

      this.ensureBlankLine();
      const genericType = isAbstract ? 'T' : typeName;

      this.emitBlock([`public final ${eventListenerHandleClassName}<${genericType}> on${eventNameAlias}(${listenerClass ? listenerClass : functionClassName} listener)`], () => {
        this.emitLine(`return this.addEventListener(new ${eventListenerHandleClassName}<${genericType}>("${eventName}", ${listenerClass ? `${consumerGetter}(listener)` : 'listener'}));`);
      });
    }

    const emitDispatchMethod = (parametersString, parameterNames) => {
      if (allowServerDispatch) {
        this.addDefferedImport(`${basePkg}.${eventDispatchHandleClassName}`);

        this.ensureBlankLine();
        this.emitBlock([`public final ${typeName} dispatch${eventNameAlias}Event(String eventName${parametersString ? `, ${parametersString}` : ''})`], () => {
          this.emitLine(`this.dispatchEvent(new ${eventDispatchHandleClassName}("${eventName}"${parameterNames ? `, ${parameterNames}` : ''}));`);
          this.emitLine('return this;');
        });
      }
    }

    if (base || !parameters || !Object.keys(parameters).length) {
      emitListenerMethod();

      if (!base) {
        emitDispatchMethod();
      }
      return;
    }

    const { parametersSignature, imports } = this.getParametersSignature(parameters);

    imports
      .filter(i => !_imports.includes(i))
      .forEach(i => {
        this.addDefferedImport(i);
      })

    const parametersString = Object.entries(parametersSignature)
      .map(([k, v]) => `${v} ${k}`).join(', ');
    const parameterNames = Object.keys(parametersSignature).join(', ');

    const eventClassName = `${eventNameAlias}EventListener`;

    const classProducer = () => {
      this.emitFileHeader(eventClassName, imports);

      this.emitLine('@FunctionalInterface');
      this.emitBlock(['public interface ', eventClassName], () => {
        this.emitLine(`void fn(${parametersString});`);
      });

      this.finishFile();
    }

    const getConsumerMethodName = `get${eventNameAlias}EventConsumer`;

    const emitConsumerGetterMethod = () => {

      this.emitBlock([`private static Consumer<Object[]> ${getConsumerMethodName}(${eventClassName} listener)`], () => {

        this.emitLine('@SuppressWarnings("unchecked")');
        this.emitBlock(['Consumer<Object[]> consumer = (params) -> '], () => {
          Object.entries(parametersSignature).forEach(([k, v], i) => {
            if (v.endsWith('...')) {
              v = v.replace('...', '[]');
            }
            this.emitLine(`${v} ${k} = (${v}) params[${i}];`);
          });
          this.emitLine(`listener.fn(${parameterNames});`);
        });
        this._emitContext.pushItem(';');

        this.emitLine(`return consumer;`);
      });
    }

    this.ensureBlankLine();
    emitConsumerGetterMethod();

    emitListenerMethod(eventClassName, getConsumerMethodName);
    emitDispatchMethod();

    finalizers.push(classProducer);
  }
}

module.exports = {
  baseComponentClassName,
  recordNodeClassName,
  fieldGetHandleClassName,
  fieldSetHandleClassName,
  behaviorInvokeHandleClassName,
  eventDispatchHandleClassName,
  eventListenerHandleClassName,
  functionClassName,
  fieldInfoClassName,
  remoteResourceClassName,
  remoteScriptResourceClassName,
  screenTargetClassName,
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
