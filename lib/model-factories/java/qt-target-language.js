/* eslint-disable no-underscore-dangle */
const lodash = require('lodash');
const {
  JavaRenderer, JavaTargetLanguage, getOptionValues, javaOptions,
} = require('quicktype-core');
const { defined, } = require('quicktype-core/dist/support/Support');
const { AcronymStyleOptions } = require('quicktype-core/dist/support/Acronyms');
const { utf16ConcatMap, escapeNonPrintableMapper, isAscii, standardUnicodeHexEscape } = require('quicktype-core/dist/support/Strings');

const assert = require('assert');
const { getAlias } = require('../../utils');

// Todo: move this to an ENV
// Important: Update this with your appId
const APP_ID = "platform";

const basePkg = 'com.re.paas.api.fusion';
const baseComponentClassName = 'BaseComponent';

const pkgName = process.env.pkgName || `${basePkg}.components.${APP_ID}`;

class JacksonJavaRenderer extends JavaRenderer {

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

  classNamer(className) {
    return this.makeNamedTypeNamer().nameStyle(className);
  }

  emitClassDefinition(c, simpleName) {

    const arrayListClass = 'java.util.ArrayList';
    const hashMapClass = 'java.util.HashMap';
    const mapClass = 'java.util.Map';
    const randomClass = 'java.util.Random';
    const consumerClass = 'java.util.function.Consumer';

    let imports = [...this.importsForType(c), ...this.importsForClass(c)];

    // "We believe" <className> to be the original name used in the schema object
    const className = Array.from(simpleName._unstyledNames)[0];

    const typeName = this.sourcelikeToString(simpleName);

    const isComponentClass = className === this.preprocessor.className;

    const {
      assetId, component,
      metadata: {
        parents: [parent],
        isAbstract,
      },
      constructor: { getAssetIdFromClassName },
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
    })

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

    const getFqClassName = (ref) => `${pkgName}.${getAssetIdFromClassName(ref)
      }.${this.classNamer(ref)}`

    if (componentImports.includes(baseComponentClassName)) {
      imports.push(`${basePkg}.${baseComponentClassName}`);
    }

    if (isComponentClass) {
      if (parent == null) {
        imports.push(`${basePkg}.${baseComponentClassName}`);
      } else {
        componentImports.push(parent.name);
      }
    }

    const enumImports = [
      ...new Set(this.enumTypes[className] || [])
    ];

    imports = [...new Set([
      ...imports,
      ...componentImports
        .filter(ref => ref != baseComponentClassName)
        .map(getFqClassName),
      ...enumImports
        .map(ref => `${pkgName}.enums.${this.classNamer(ref)}`)
    ])];

    this.emitFileHeader(simpleName, imports);
    this.emitDescription(this.descriptionForType(c));
    this.emitClassAttributes(c, simpleName);
    this.emitBlock([
      'public', isAbstract ? ' abstract' : '', ' class ', simpleName,
      isComponentClass ? ` extends ${parent == null ? baseComponentClassName : this.classNamer(parent.name)}` : ''
    ], () => {

      this.emitLine('');

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
        if (this._options.lombok && this._options.lombokCopyAnnotations) {
          const getter = this.annotationsForAccessor(c, simpleName, name, jsonName, p, false);
          const setter = this.annotationsForAccessor(c, simpleName, name, jsonName, p, true);
          if (getter.length !== 0) {
            this.emitLine(`@lombok.Getter(onMethod_ = {${getter.join(', ')}})`);
          }
          if (setter.length !== 0) {
            this.emitLine(`@lombok.Setter(onMethod_ = {${setter.join(', ')}})`);
          }
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

        this.emitLine('private ', this.javaType(false, p.type, true), ' ', name, `${initialValue};`);
      });

      if (isComponentClass) {

        if (!isAbstract) {
          this.ensureBlankLine();
          this.emitLine('public String getAssetId() {\n  return "', assetId, '"; \n}');
        }

        // Add behavior methods
        behaviours.forEach(behaviour => {
          if (typeof component[behaviour] != 'function') {
            throw Error(`[${typeName}] Unknown behaviour: ${behaviour}`);
          }

          this.ensureBlankLine();
          this.emitLine(`public void ${behaviour}() {`);
          this.emitLine(`  this.invokeBehaviour("${behaviour}");`);
          this.emitLine('}');
        })

        // Add event methods
        events.forEach(event => {
          this.ensureBlankLine();
          this.emitLine(`public ${typeName} on${getAlias(event)}(Consumer<Map<String, Object>> consumer) {`);
          this.emitLine(`  this.addEventListener("${event}", consumer);`);
          this.emitLine(`  return this;`);
          this.emitLine('}');
        });

      }

      if (!this._options.lombok) {

        this.forEachClassProperty(c, 'leading-and-interposing', (name, jsonName, p) => {

          this.emitDescription(this.descriptionForClassProperty(c, jsonName));
          let [getterName, setterName] = defined(
            this._gettersAndSettersForPropertyName.get(name),
          );

          // Getter for boolean attributes should be is..., not get...
          if (p.type.kind == 'bool') {
            getterName = lodash.camelCase(`is_${jsonName}`);
          }

          const rendered = this.javaType(false, p.type);
          this.annotationsForAccessor(c, simpleName, name, jsonName, p, false)
            .forEach(annotation => this.emitLine(annotation));
          this.emitLine('public ', rendered, ' ', getterName, '() {\n  return ', name, '; \n}');

          this.annotationsForAccessor(c, simpleName, name, jsonName, p, true)
            .forEach(annotation => this.emitLine(annotation));
          this.ensureBlankLine();
          this.emitLine('public ', `${typeName} `, setterName, '(', rendered, ' value) {\n  this.', name, ' = value; \n  return this; \n}');

          if (Array.isArray(rendered)) {

            // If this is a collection-based field, add extra methods to help developers
            // with fluency

            let isList = rendered[0] == 'List<';
            let isMap = rendered[0] == 'Map<String, ';

            assert(isList || isMap);
            assert(rendered[2] == '>');

            let singularType = rendered[1];

            // We may not be able to use the singularType in the add...() and remove...() methods because the
            // singularType may not be intrinsic to the collection, for example: an enum array for a shared enum
            const singularClause = jsonName.charAt(0).toUpperCase() + jsonName.slice(1).replace(/s$/g, '');

            if (singularType.constructor.name == 'Array') {
              // This is a nested collection, so don't add the flent methods
              isList = isMap = false;

            } else if (singularType.constructor.name == 'SimpleName') {
              singularType = this.sourcelikeToString(singularType);
            }

            switch (true) {
              case isList:
                this.emitLine(
                  'public ', `${typeName} `, `add${singularClause}`,
                  '(', singularType, ' value) {\n  this.', name, '.add(value); \n  return this; \n}'
                );
                this.emitLine(
                  'public ', `${typeName} `, `remove${singularClause}`,
                  '(', singularType, ' value) {\n  this.', name, '.remove(value); \n  return this; \n}'
                );
                break;

              case isMap:
                this.emitLine(
                  'public ', `${typeName} `, `add${singularClause}`,
                  '(String name, ', singularType, ' value) {\n  this.', name, '.put(name, value); \n  return this; \n}'
                );
                this.emitLine(
                  'public ', `${typeName} `, `remove${singularClause}`,
                  '(String name) {\n  this.', name, '.remove(name); \n  return this; \n}'
                );
                break;
            }
          }

        });
      }
    });
    this.finishFile();
  }

  emitEnumDefinition(e, enumName) {
    const stringEscape = utf16ConcatMap(escapeNonPrintableMapper(isAscii, standardUnicodeHexEscape));

    this.emitFileHeader(enumName, this.importsForType(e));
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

      this.emitEnumSerializationAttributes(e);
      this.emitBlock(['public String getValue()'], () => {
        this.emitLine(`return value;`);
      });
      this.ensureBlankLine();

      this.emitEnumDeserializationAttributes(e);
      this.emitBlock(["public static ", enumName, " forValue(String value) throws IOException"], () => {
        this.forEachEnumCase(e, "none", (name, jsonName) => {
          this.emitLine('if (value.equals("', stringEscape(jsonName), '")) return ', name, ";");
        });
        this.emitLine('throw new IOException("Cannot deserialize ', enumName, '");');
      });
    });
    this.finishFile();
  }
}

module.exports = {
  baseComponentClassName,
  basePkg,
  pkgName,
  targetLanguageFactory: ({
    preprocessor, componentTypes, enumTypes, packageName, generic = true,
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

        if (generic) {
          return new JavaRenderer(
            this, renderContext, rendererOptions,
          )
        } else {
          const renderer = new JacksonJavaRenderer(
            this, renderContext, rendererOptions,
          );
          renderer.preprocessor = preprocessor;

          renderer.componentTypes = componentTypes;
          renderer.enumTypes = enumTypes;

          return renderer;
        }
      }
    },
};
