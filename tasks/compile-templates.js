/* eslint-disable no-console */
const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const watch = require('gulp-watch');
const handlebars = require('handlebars');
const through = require('through2');
const log = require('fancy-log');
const TemplateProcessor = require('../lib/template-preprocessor');
const TemplateReader = require('../lib/template-reader');
const utils = require('../lib/utils');

// eslint-disable-next-line func-names
const gulpTransform = function () {
  return through.obj((vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    const componentDir = path.dirname(file.path);
    const pluginDir = path.dirname(componentDir);

    const componentName = path.relative(pluginDir, componentDir);
    const pluginName = path.relative(path.dirname(pluginDir), pluginDir);

    const identifier = `${pluginName}/${componentName}`;
    const assetId = utils.generateRandomString();

    const templateString = fs.readFileSync(`${componentDir}/template.hbs`, 'utf8');

    TemplateReader.reset();

    const processor = new TemplateProcessor({
      assetId,
      logger: log,
      pluginName,
      componentName,
      ast: handlebars.parse(templateString),
    });

    // Precompile main ast
    const main = `/* eslint-disable */
    \nglobal.template_${assetId} = ${handlebars.precompile(processor.ast)}`;

    // eslint-disable-next-line no-eval
    eval(`${main}`);

    const { component } = processor;

    component.onClient = false;
    component.resolver = undefined;

    component.getDataStore()
      .set(component.id, {
        input: processor.resolver.getSample(),
      });

    component.load();

    // Cleanup global scope
    component.releaseGlobal();

    // Write server html
    fs.writeFileSync(`${processor.getDistPath()}/server.html`, component.html);

    // Rewrite path to use assetId instead
    file.path = path.join(file.base, file.relative.replace(identifier, assetId));

    // Store precompiled template
    file.basename = 'template.min.js';
    // eslint-disable-next-line no-buffer-constructor
    file.contents = Buffer.from(main);

    callback(null, file);
  });
};

gulp.task('compile-templates',
  () => gulp.src('src/plugins/**/template.hbs')
    .pipe(gulpTransform())
    .pipe(gulp.dest('./dist/component-assets')));


gulp.task('compile-templates:watch', () => watch('src/plugins/**/template.hbs', { ignoreInitial: false })
  .pipe(gulpTransform())
  .pipe(gulp.dest('./dist/component-assets')));
