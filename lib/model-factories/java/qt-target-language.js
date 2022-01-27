/* eslint-disable no-underscore-dangle */
const lodash = require('lodash');
const {
  JavaRenderer, JavaTargetLanguage, getOptionValues, javaOptions,
} = require('quicktype-core');
const { defined } = require('quicktype-core/dist/support/Support');
const { AcronymStyleOptions } = require('quicktype-core/dist/support/Acronyms');
const assert = require('assert');
const { getAlias } = require('../../utils');

// Todo: move this to an ENV
// Important: Update this with your appId
const APP_ID = "platform";

const basePkg = 'com.re.paas.api.fusion';
const baseComponentClassName = 'BaseComponent';

const pkgName = process.env.pkgName || `${basePkg}.components.${APP_ID}`;

/**
 * Note: A given component class can only access it's own classes as well as jvm
 * classes
 */
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

  emitClassDefinition(c, simpleName) {
    let imports = [...this.importsForType(c), ...this.importsForClass(c)];

    // "We believe" <className> to be the original name used in the schema object
    const className = Array.from(simpleName._unstyledNames)[0];

    const typeName = this.sourcelikeToString(simpleName);

    const isComponentClass = className === this.preprocessor.className;

    const classNamer = (name) => this.makeNamedTypeNamer().nameStyle(name);

    const { getAssetIdFromClassName, assetId, component } = this.preprocessor;

    const { behaviours, events } = component;

    // Since, we eagerly initialize collection-based field, we need to add
    // imports here, if necessary
    this.forEachClassProperty(c, 'none', (name, jsonName, p) => {

      const getCollectionImplClass = () => {

        const arrayListClass = 'java.util.ArrayList';
        const hashMapClass = 'java.util.HashMap';

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

    if (events().length) {
      // These classes are used by the generated event methods
      imports.push('java.util.Map');
      imports.push('java.util.function.Consumer');
    }

    if (isComponentClass) {
      imports.push('java.util.Random');
    }

    const componentImports = [
      ...new Set(this.componentTypes[className] || [])
    ];

    if (isComponentClass || componentImports.includes(baseComponentClassName)) {
      imports.push(`${basePkg}.${baseComponentClassName}`);
    }

    const enumImports = [
      ...new Set(this.enumTypes[className] || [])
    ];

    imports = [...new Set([
      ...imports,
      ...componentImports
        .filter(ref => ref != baseComponentClassName)
        .map(ref => `${pkgName}.${getAssetIdFromClassName(ref)
          }.${classNamer(ref)}`),
      ...enumImports
        .map(ref => `${pkgName}.enums.${classNamer(ref)}`)
    ])];

    this.emitFileHeader(simpleName, imports);
    this.emitDescription(this.descriptionForType(c));
    this.emitClassAttributes(c, simpleName);
    this.emitBlock(['public', ' class ', simpleName, isComponentClass ? ` extends ${baseComponentClassName}` : ''], () => {

      this.emitLine('');

      if (isComponentClass) {
        this.emitLine('private static Random random = new Random();');

        this.emitBlock(['public ', typeName, '()'], () => {
          this.emitLine(`super("${assetId}_" + random.nextInt(Integer.MAX_VALUE));`);
        });
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

        this.emitLine('\npublic String getAssetId() {\n  return "', assetId, '"; \n}');

        // Add behavior methods
        behaviours().forEach(behaviour => {
          if (typeof component[behaviour] != 'function') {
            throw Error(`[${typeName}] Unknown behaviour: ${behaviour}`);
          }

          this.emitLine(`\npublic void ${behaviour}() {`);
          this.emitLine(`  super.invokeBehaviour("${behaviour}");`);
          this.emitLine('}');
        })

        // Add event methods
        events().forEach(event => {
          this.emitLine(`\npublic ${typeName} on${getAlias(event)}(Consumer<Map<String, Object>> consumer) {`);
          this.emitLine(`  super.addEventListener("${event}", consumer);`);
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
          this.emitLine('public ', rendered, ' ', getterName, '() {\n  return this.', name, '; \n}');

          this.annotationsForAccessor(c, simpleName, name, jsonName, p, true)
            .forEach(annotation => this.emitLine(annotation));
          this.emitLine('\npublic ', `${typeName} `, setterName, '(', rendered, ' value) {\n  this.', name, ' = value; \n  return this; \n}');

          if (Array.isArray(rendered)) {

            // If this is a collection-based field, add extra methods to help developers
            // with fluency

            let isList = rendered[0] == 'List<';
            let isMap = rendered[0] == 'Map<String, ';

            assert(isList || isMap);
            assert(rendered[2] == '>');

            let singularType = rendered[1];

            if (singularType.constructor.name == 'Array') {
              // This is a nested collection, so don't add the flent methods
              isList = isMap = false;

            } else if (singularType.constructor.name == 'SimpleName') {
              singularType = Array.from(singularType._unstyledNames)[0]
            }

            switch (true) {
              case isList:
                this.emitLine(
                  'public ', `${typeName} `, `add${singularType}`,
                  '(', singularType, ' value) {\n  this.', name, '.add(value); \n  return this; \n}'
                );
                this.emitLine(
                  'public ', `${typeName} `, `remove${singularType}`,
                  '(', singularType, ' value) {\n  this.', name, '.remove(value); \n  return this; \n}'
                );
                break;

              case isMap:
                this.emitLine(
                  'public ', `${typeName} `, `add${singularType}`,
                  '(String name, ', singularType, ' value) {\n  this.', name, '.put(name, value); \n  return this; \n}'
                );
                this.emitLine(
                  'public ', `${typeName} `, `remove${singularType}`,
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
