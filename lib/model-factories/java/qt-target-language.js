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

const { getAlias, generateRandomString } = require('../../utils');
const PathResolver = require('../../path-resolver');
const SchemaGenerator = require('../../schema-generator');

const { APP_ID } = process.env;

if (!APP_ID) {
  throw Error(`Please specify your APP_ID`);
}

const basePkg = 'com.re.paas.api.fusion';
const baseComponentClassName = 'BaseComponent';
const dataNodeClassName = 'DataNode';

const pkgName = `${basePkg}.components.${APP_ID}`;

const noOpClassName = generateRandomString(6);
const dataNodeClassNamePrefix = 'Remote';
class FusionJavaRenderer extends JavaRenderer {

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
    const {
      constructor: { getAssetIdFromClassName },
    } = this.preprocessor;
    return `${pkgName}.${getAssetIdFromClassName(n)
      }.${this.classNamer(n)}`;
  }

  emitSourceStructure() {
    this.forEachNamedType(
      "leading-and-interposing",
      (c, n) => this.emitClassDefinitions(c, n),
      (e, n) => this.emitEnumDefinition(e, n),
      (u, n) => this.emitUnionDefinition(u, n));
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
      this.emitDataNodeClassDefinition(c, n);
    }
  }

  getMapKeyType(path) {
    const { keyTypeConfigProperty } = PathResolver;
    const literalTypes = ['string', 'number', 'boolean'];

    const config = this.preprocessor.resolver.config.collections[path];
    assert(!!config)

    const {
      [keyTypeConfigProperty]: keyType = 'String'
    } = config;

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

  static visitCollectionGenericTypes(path, typeName, fn, suffix = '.$_') {
    const { visitCollectionGenericTypes0 } = FusionJavaRenderer;
    let p = path;

    visitCollectionGenericTypes0(typeName, (t) => {
      fn(p, t);
      p = `${p}${suffix}`
    });
  }

  getPaths(c) {
    const paths = {};
    this.forEachClassProperty(c, 'none', (name, jsonName, p) => {
      const path = this.getPath0(c, jsonName);
      paths[path] = this.javaType(false, p.type);
    });
    return paths;
  }

  getPath0(c, jsonName) {
    let { path } = JSON.parse(
      this.sourcelikeToString(this.descriptionForClassProperty(c, jsonName))
    );
    return path;
  }

  static isMapType(t) {
    return Array.isArray(t) && t[0] == 'Map<String, ';
  }

  getFieldType(c, jsonName, p) {
    const { visitCollectionGenericTypes, isMapType } = FusionJavaRenderer;
    const typeName = this.javaType(false, p.type);

    // If this is a map, change the first generic type from 'String' to whatever keyType
    // is configured for this map
    visitCollectionGenericTypes(
      this.getPath0(c, jsonName),
      typeName,
      (p, t) => {
        if (isMapType(t)) {
          t[0] = `Map<${this.classNamer(this.getMapKeyType(p))}, `;
        }
      });

    return typeName;
  }

  getEnumImports(className, c) {
    const { visitCollectionGenericTypes, isMapType } = FusionJavaRenderer;

    const enumImports = this.enumTypes[className] || [];

    // Add enum imports from map keys
    Object.entries(this.getPaths(c))
      .filter(([p, t]) => isMapType(t))
      .forEach(([p, t]) => {
        visitCollectionGenericTypes(p, t, (path, typeName) => {
          if (!isMapType(typeName)) {
            return;
          }
          const keyType = this.getMapKeyType(path);
          if (!['String', 'Number', 'Boolean'].includes(keyType)) {
            enumImports.push(keyType)
          }
        });
      });

    return [...new Set(enumImports)]
      .map(n => this.toFqEnumClassName(n));
  }

  emitMainClassDefinition(c, simpleName) {

    const arrayListClass = 'java.util.ArrayList';
    const hashMapClass = 'java.util.HashMap';
    const mapClass = 'java.util.Map';
    const randomClass = 'java.util.Random';
    const consumerClass = 'java.util.function.Consumer';

    let imports = [...this.importsForType(c), ...this.importsForClass(c)];

    const className = Array.from(simpleName._unstyledNames)[0];
    const typeName = this.sourcelikeToString(simpleName);

    const isComponentClass = className === this.preprocessor.className;

    const {
      assetId, component,
      metadata: {
        parents: [parent],
        isAbstract,
      },
    } = this.preprocessor;

    const behaviours = component.getBehaviours();
    const events = component.getEvents()

    // Since, we eagerly initialize collection-based field, we need to add
    // imports here, if necessary
    this.forEachClassProperty(c, 'none', (name, jsonName, p) => {

      const getCollectionImplClass = () => {
        switch (p.type.kind) {
          case 'array':
            return arrayListClass;
          case 'map':
            return hashMapClass;
          default:
            return null;
        }
      }
      const implClass = getCollectionImplClass();

      if (implClass && !imports.includes(implClass)) {
        imports.push(implClass);
      }
    });

    if (isComponentClass) {

      imports.push(randomClass);

      if (events.length) {
        imports.push(mapClass);
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
        componentImports.push(parent.name);
      }
    }

    imports = [...new Set([
      ...imports,
      ...componentImports
        .map((n) => this.toFqComponentClassName(n)),
      ...this.getEnumImports(className, c),
    ])];

    this.emitFileHeader(simpleName, imports);
    this.emitDescription(this.descriptionForType(c));
    this.emitBlock([
      'public', isAbstract ? ' abstract' : '', ' class ', simpleName,
      isComponentClass ? ` extends ${parent == null ? baseComponentClassName : this.classNamer(parent.name)}` : ''
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
        const fieldType = this.getFieldType(c, jsonName, p);

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

      if (isComponentClass) {

        if (!isAbstract) {
          this.ensureBlankLine();

          this.emitBlock(['public String getAssetId()'], () => {
            this.emitLine('return "', assetId, '";');
          });
        }

        // Add behavior methods
        behaviours.forEach(behaviour => {
          if (typeof component[behaviour] != 'function') {
            throw Error(`[${typeName}] Unknown behaviour: ${behaviour}`);
          }

          this.ensureBlankLine();

          this.emitBlock([`public void ${behaviour}()`], () => {
            this.emitLine(`this.invokeBehaviour("${behaviour}");`);
          });
        })

        // Add event methods
        events.forEach(event => {
          this.ensureBlankLine();

          this.emitBlock([`public ${typeName} on${getAlias(event)}(Consumer<Map<String, Object>> consumer)`], () => {
            this.emitLine(`this.addEventListener("${event}", consumer);`);
            this.emitLine(`return this;`);
          });
        });
      }

      this.forEachClassProperty(c, 'leading-and-interposing', (name, jsonName, p) => {
        // this.emitDescription(this.descriptionForClassProperty(c, jsonName));

        const fieldType = this.getFieldType(c, jsonName, p);

        let [getterName, setterName] = defined(
          this._gettersAndSettersForPropertyName.get(name),
        );

        // Getter for boolean attributes should be is..., not get...
        if (p.type.kind == 'bool') {
          getterName = lodash.camelCase(`is_${jsonName}`);
        }

        this.emitBlock(['public ', fieldType, ' ', getterName, '()'], () => {
          this.emitLine('return ', name, ';');
        });

        this.ensureBlankLine();

        this.emitBlock(['public ', `${typeName} `, setterName, '(', fieldType, ' value)'], () => {
          this.emitLine('this.', name, ' = value;');
          this.emitLine('return this;');
        });

        if (Array.isArray(fieldType)) {

          // If this is a collection-based field, add extra methods to help
          // developers with fluency

          let isList = fieldType[0] == 'List<';
          let isMap = fieldType[0].startsWith('Map<');

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

    });
    this.finishFile();

    if (isComponentClass) {
      fs.writeFileSync(
        pathLib.join(
          process.env.PWD, 'dist', 'components', assetId, '.mainClass',
        ),
        `${this.packageName}.${typeName}`,
      )
    }
  }

  emitDataNodeClassDefinition(c, simpleName) {

    const { assetId } = this.preprocessor;

    const className = Array.from(simpleName._unstyledNames)[0];

    const parentName = this.sourcelikeToString(simpleName);
    const typeName = `${dataNodeClassNamePrefix}${parentName}`;

    const isComponentClass = className === this.preprocessor.className;

    let imports = [...this.importsForType(c), ...this.importsForClass(c)];

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
    this.emitDescription(this.descriptionForType(c));

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
        // this.emitDescription(this.descriptionForClassProperty(c, jsonName));

        const fieldType = this.getFieldType(c, jsonName, p);

        let [getterName, setterName] = defined(
          this._gettersAndSettersForPropertyName.get(name),
        );

        // Getter for boolean attributes should be is..., not get...
        if (p.type.kind == 'bool') {
          getterName = lodash.camelCase(`is_${jsonName}`);
        }

        this.emitLine('@Override');
        this.emitBlock(['public ', fieldType, ' ', getterName, '()'], () => {

          switch (true) {
            case this.getEnumClasses().includes(this.sourcelikeToString(fieldType)):
              this.emitLine(fieldType, ' value = ', fieldType, '.forValue((String) this.getProperty("', name, '", "String"));');
              break;

            default:
              this.emitLine(`@SuppressWarnings("unchecked")`);
              this.emitLine(fieldType, ' value = (', fieldType, ') this.getProperty("', name, '", "', fieldType, '");');
              break;
          }

          this.emitLine('return value;');
        });

        this.ensureBlankLine();

        this.emitLine('@Override');
        this.emitBlock([`public ${typeName} `, setterName, '(', fieldType, ' value)'], () => {
          this.emitLine(`this.setProperty("`, name, `", value);`);
          this.emitLine('return this;');
        });

      });

    });
    this.finishFile();
  }

  emitEnumDefinition(e, enumName) {
    const stringEscape = utf16ConcatMap(escapeNonPrintableMapper(isAscii, standardUnicodeHexEscape));
    const imports = [];

    this.emitFileHeader(enumName, imports);
    this.emitDescription(this.descriptionForType(e));

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
