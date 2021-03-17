/* eslint-disable no-underscore-dangle */
const lodash = require('lodash');
const {
  JavaRenderer, JavaTargetLanguage, getOptionValues, javaOptions,
} = require('quicktype-core');
const { defined } = require('quicktype-core/dist/support/Support');
const { AcronymStyleOptions } = require('quicktype-core/dist/support/Acronyms');
const assert = require('assert');

const basePkg = 'com.re.paas.fusion';
const baseComponentClassName = 'BaseComponent';

const pkgName = process.env.pkgName || `${basePkg}.components`;

class JacksonJavaRenderer extends JavaRenderer {
  emitClassAttributes(classType, className) {
    super.emitClassAttributes(classType, className);
    // this.emitLine('@ThisIsMySuperCustomAnnotation');
  }

  // eslint-disable-next-line class-methods-use-this
  makeNamedTypeNamer() {
    return this.getNameStyling('typeNamingFunction');
  }

  emitClassDefinition(c, simpleName) {
    let imports = [...this.importsForType(c), ...this.importsForClass(c)];

    // "We believe" <className> to be the original name used in the schema object
    const className = Array.from(simpleName._unstyledNames)[0];

    const typeName = this.sourcelikeToString(simpleName);

    const isComponentClass = className === this.preprocessor.className;

    const classNamer = (name) => this.makeNamedTypeNamer().nameStyle(name);

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

    imports = [
      ...imports,
      ...componentImports
        .filter(ref => ref != baseComponentClassName)
        .map(ref => `${pkgName}.${this.preprocessor.getAssetIdFromClassName(ref)
          }.${classNamer(ref)}`),
      ...enumImports
        .map(ref => `${basePkg}.enums.${classNamer(ref)}`)
    ];

    this.emitFileHeader(simpleName, imports);
    this.emitDescription(this.descriptionForType(c));
    this.emitClassAttributes(c, simpleName);
    this.emitBlock(['public', ' class ', simpleName, isComponentClass ? ` extends ${baseComponentClassName}` : ''], () => {

      if (isComponentClass) {
        this.emitLine('private static Random random = new Random();');

        this.emitBlock(['public ', typeName, '()'], () => {
          this.emitLine(`super("${this.preprocessor.assetId}_" + random.nextInt(Integer.MAX_VALUE + 1));`);
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
          this.emitLine('public ', `${typeName} `, setterName, '(', rendered, ' value) {\n  this.', name, ' = value; \n  return this; \n}');

          if (Array.isArray(rendered)) {

            // If this is a collection-based field, add extra methods to help developers
            // with fluency

            const isList = rendered[0] == 'List<';
            const isMap = rendered[0] == 'Map<String, ';

            assert(isList || isMap);
            assert(rendered[2] == '>');

            const singularType = rendered[1];

            switch (true) {
              case isList:
                this.emitLine(
                  'public ', `${typeName} `, lodash.camelCase(`add_${jsonName}`),
                  '(', singularType, ' value) {\n  this.', name, '.add(value); \n  return this; \n}'
                );
                this.emitLine(
                  'public ', `${typeName} `, lodash.camelCase(`remove_${jsonName}`),
                  '(', singularType, ' value) {\n  this.', name, '.remove(value); \n  return this; \n}'
                );
                break;

              case isMap:
                this.emitLine(
                  'public ', `${typeName} `, lodash.camelCase(`add_${jsonName}`),
                  '(String name, ', singularType, ' value) {\n  this.', name, '.put(name, value); \n  return this; \n}'
                );
                this.emitLine(
                  'public ', `${typeName} `, lodash.camelCase(`remove_${jsonName}`),
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
