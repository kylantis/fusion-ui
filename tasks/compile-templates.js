const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const watch = require('gulp-watch');
const handlebars = require('handlebars');
const through = require('through2');
const assert = require('assert');
const TemplateProcessor = require('../lib/template-preprocessor');
const TemplateReader = require('../lib/template-reader');

// eslint-disable-next-line func-names
const gulpTransform = function () {
  return through.obj((vinylFile, _encoding, callback) => {
    const hbsFile = vinylFile.clone();

    const dir = path.dirname(hbsFile.path);
    const templatePath = `${dir}/template.hbs`;

    const componentName = path.relative(path.dirname(dir), dir);
    const content = fs.readFileSync(templatePath, 'utf8');

    // eslint-disable-next-line no-console
    console.log(`\x1b[32m[${componentName}]\x1b[0m`);

    TemplateReader.reset();

    const processor = new TemplateProcessor({
      templatePath,
      componentName,
      ast: handlebars.parse(content),
      registerDynamicDataHelpers: true,
    });

    // Precompile template
    const compiled = handlebars.precompile(processor.ast);
    const templateId = `kclient_${componentName}_template`;

    const output = `${templateId}=${compiled};`;

    // Render the component
    // Update global scope
    const DsProxy = fs.readFileSync(
      path.join(
        path.dirname(path.dirname(templatePath)),
        'proxy.js',
      ),
      'utf8',
    );
    global.assert = assert;
    const baseComponent = Object.getPrototypeOf(
      Object.getPrototypeOf(processor.component),
    );
    global[baseComponent.constructor.name] = baseComponent.constructor;
    // eslint-disable-next-line no-eval
    global.DsProxy = eval(DsProxy);
    global.Handlebars = handlebars;
    // eslint-disable-next-line no-eval
    eval(`global.${output}`);
    // const html = processor.component.render();
    const html = '';

    // Cleanup global scope
    delete global.DsProxy;
    delete global.Handlebars;
    delete global[templateId];

    // Write server html
    fs.writeFileSync(`${processor.getComponentDistPath()}/server.html`, html);


    // Store precompiled template
    hbsFile.basename = 'template.min.js';
    // eslint-disable-next-line no-buffer-constructor
    hbsFile.contents = Buffer.from(output);

    callback(null, hbsFile);
  });
};

gulp.task('compile-templates',
  () => gulp.src('src/components/**/template.hbs')
    .pipe(gulpTransform())
    .pipe(gulp.dest('./dist/components')));


gulp.task('compile-templates-all:watch', () => watch('src/components/**/*.hbs', { ignoreInitial: true })
  .pipe(gulpTransform())
  .pipe(gulp.dest('./dist/components')));

gulp.task('compile-templates:watch', gulp.parallel('compile-templates', 'compile-templates-all:watch'));
