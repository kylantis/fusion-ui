const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const watch = require('gulp-watch');
const handlebars = require('handlebars');
const through = require('through2');
const TemplateProcessor = require('../lib/template-preprocessor');
const TemplateReader = require('../lib/template-reader');

// eslint-disable-next-line func-names
const gulpTransform = function () {
  return through.obj((vinylFile, _encoding, callback) => {
    const transformedFile = vinylFile.clone();

    const dir = path.dirname(transformedFile.path);
    const templatePath = `${dir}/template.hbs`;

    const componentName = path.relative(path.dirname(dir), dir);
    const content = fs.readFileSync(templatePath, 'utf8');

    // eslint-disable-next-line no-console
    console.log(`\x1b[32m[${componentName}]\x1b[0m`);

    TemplateReader.reset();

    const rendered = new TemplateProcessor({
      templatePath,
      ast: handlebars.parseWithoutProcessing(content),
      registerDynamicDataHelpers: true,
    }).process();

    // eslint-disable-next-line no-console
    console.log('\n');

    const output = `window.kclient_${componentName}_template=${rendered}`;

    transformedFile.basename = 'template.min.js';
    // eslint-disable-next-line no-buffer-constructor
    transformedFile.contents = Buffer.from(output);

    callback(null, transformedFile);
  });
};

gulp.task('compile-templates', () => gulp.src('src/components/**/template.hbs')
  .pipe(gulpTransform())
  .pipe(gulp.dest('./dist/components')));


gulp.task('compile-templates-all:watch', () => watch('src/components/**/*.hbs', { ignoreInitial: true })
  .pipe(gulpTransform())
  .pipe(gulp.dest('./dist/components')));

gulp.task('compile-templates:watch', gulp.parallel('compile-templates', 'compile-templates-all:watch'));
