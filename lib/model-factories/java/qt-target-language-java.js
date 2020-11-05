/* eslint-disable no-underscore-dangle */
const {
  JavaRenderer, JavaTargetLanguage, getOptionValues, javaOptions,
} = require('quicktype-core');
const { defined } = require('quicktype-core/dist/support/Support');
const { AcronymStyleOptions } = require('quicktype-core/dist/support/Acronyms');

const baseComponentPkg = 'com.re.paas.fusion';
const baseComponentClassName = 'BaseComponent';
const baseComponentIdField = 'id';

const pkgName = process.env.pkgName || 'com.re.paas.fusion.components';

class JacksonJavaRenderer extends JavaRenderer {
  emitClassAttributes(classType, className) {
    super.emitClassAttributes(classType, className);
    // this.emitLine('@ThisIsMySuperCustomAnnotation');
  }

  // eslint-disable-next-line class-methods-use-this
  // makeNamedTypeNamer() {
  //   return this.getNameStyling('typeNamingFunction');
  // }

  emitClassDefinition(c, className) {
    let imports = [...this.importsForType(c), ...this.importsForClass(c)];

    const typeName = this.sourcelikeToString(className);
    if (baseComponentClassName === typeName) {
      throw new Error(`Invalid name: ${typeName}`);
    }

    const isComponentClass = typeName === this.preprocessor.className;

    if (isComponentClass) {
      imports = [
        ...imports,
        'java.util.Random',
        `${baseComponentPkg}.${baseComponentClassName}`,
      ];
    }

    // Add imports for componentRefs
    imports = [
      ...imports,
      ...(this.componentRefs[typeName] || [])
        .map(ref => `${pkgName}.${
          this.preprocessor.getAssetIdFromClassName(ref)
        }.${ref}`),
    ];

    this.emitFileHeader(className, imports);
    this.emitDescription(this.descriptionForType(c));
    this.emitClassAttributes(c, className);
    this.emitBlock(['public', ' class ', className, isComponentClass ? ` extends ${baseComponentClassName}` : ''], () => {
      if (isComponentClass) {
        this.emitLine('private static Random random = new Random();');

        this.emitBlock(['public ', typeName, '()'], () => {
          this.emitLine(`super("${this.preprocessor.assetId}_" + random.nextInt(Integer.MAX_VALUE + 1));`);
        });
      }
      this.forEachClassProperty(c, 'none', (name, jsonName, p) => {
        if (this._options.lombok && this._options.lombokCopyAnnotations) {
          const getter = this.annotationsForAccessor(c, className, name, jsonName, p, false);
          const setter = this.annotationsForAccessor(c, className, name, jsonName, p, true);
          if (getter.length !== 0) {
            this.emitLine(`@lombok.Getter(onMethod_ = {${getter.join(', ')}})`);
          }
          if (setter.length !== 0) {
            this.emitLine(`@lombok.Setter(onMethod_ = {${setter.join(', ')}})`);
          }
        }
        this.emitLine('private ', this.javaType(false, p.type, true), ' ', name, ';');
      });
      if (!this._options.lombok) {
        this.forEachClassProperty(c, 'leading-and-interposing', (name, jsonName, p) => {
          this.emitDescription(this.descriptionForClassProperty(c, jsonName));
          const [getterName, setterName] = defined(
            this._gettersAndSettersForPropertyName.get(name),
          );
          const rendered = this.javaType(false, p.type);
          this.annotationsForAccessor(c, className, name, jsonName, p, false)
            .forEach(annotation => this.emitLine(annotation));
          this.emitLine('public ', rendered, ' ', getterName, '() { return ', name, '; }');
          this.annotationsForAccessor(c, className, name, jsonName, p, true)
            .forEach(annotation => this.emitLine(annotation));
          this.emitLine('public ', `${typeName} `, setterName, '(', rendered, ' value) { this.', name, ' = value; return this; }');
        });
      }
    });
    this.finishFile();
  }
}

const getOptions = ({ assetId }) => ({
  useList: true,
  lombok: false,
  lombokCopyAnnotations: false,
  dateTimeProvider: 'java8',
  packageName: `${pkgName}.${assetId}`,
  acronymStyle: AcronymStyleOptions.Camel,
});

module.exports = {
  baseComponentIdField,
  baseComponentClassName,
  baseComponentPkg,
  pkgName,
  create: ({
    preprocessor, componentRefs,
  }) => class JacksonJavaTargetLanguage extends JavaTargetLanguage {
    constructor() {
      super('Java', ['java'], 'java');
    }

    makeRenderer(renderContext, untypedOptionValues) {
      const options = getOptionValues(
        javaOptions,
        untypedOptionValues,
      );
      const renderer = new JacksonJavaRenderer(
        this, renderContext,
        { ...options, ...getOptions({ assetId: preprocessor.assetId }) },
      );
      renderer.preprocessor = preprocessor;
      renderer.componentRefs = componentRefs;

      return renderer;
    }
  },
};
