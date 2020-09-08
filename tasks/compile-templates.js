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

// eslint-disable-next-line func-names
const gulpTransform = function () {
  return through.obj((vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    const dir = path.dirname(file.path);
    const componentName = path.relative(path.dirname(dir), dir);

    const templateString = fs.readFileSync(`${dir}/template.hbs`, 'utf8');

    TemplateReader.reset();

    const processor = new TemplateProcessor({
      assetId: componentName,
      logger: log,
      componentName,
      ast: handlebars.parse(templateString),
    });

    log.info(`\x1b[32m[Processing ${componentName}]\x1b[0m`);

    // Precompile main ast
    const main = `/* eslint-disable */
    \nglobal['template_${componentName}'] = ${handlebars.precompile(processor.ast)}`;

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

    // file.path = path.join(file.base, file.relative);

    // Store precompiled template
    file.basename = 'template.min.js';
    // eslint-disable-next-line no-buffer-constructor
    file.contents = Buffer.from(main);

    callback(null, file);
  });
};

gulp.task('compile-templates',
  () => gulp.src(['src/components/**/template.hbs'])
    .pipe(gulpTransform())
    .pipe(gulp.dest('dist/components')));

gulp.task('compile-templates:watch',
  () => watch(['src/components/**/*.hbs', 'src/components/**/*.js'], { ignoreInitial: true })
    .pipe(gulpTransform())
    .pipe(gulp.dest('dist/components')));
