/* eslint-disable no-undef */
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');

const gulp = require('gulp');
const watch = require('gulp-watch');
const through = require('through2');

const { processFile } = require('../lib/template-processor');

// eslint-disable-next-line func-names
const gulpTransform = function () {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    const dir = path.dirname(file.path);

    if (fs.existsSync(path.join(dir, '.skip'))) {
      // Todo: remove this, and find a proper fix
      // return callback(null, file);
    }

    const { assetId, metadata, error } = await processFile({
      dir,
      fromGulp: true,
    });

    // write precompiled template
    file.basename = 'metadata.min.js';
    file.path = path.join(path.dirname(path.dirname(file.path)), assetId, file.basename);
    // eslint-disable-next-line no-buffer-constructor
    file.contents = Buffer.from(metadata || '');

    // Note: If error is true, an error ocurred

    callback(null, file);
  });
};

const componentArgPrefix = '--component=';
const tailArgument = process.argv[process.argv.length - 1];

const componentName = tailArgument.startsWith(componentArgPrefix) ?
  tailArgument.replace(componentArgPrefix, '') : null;

gulp.task('compile-templates',
  () => gulp.src([`src/components/${componentName || '*'}/index.view`])
    .pipe(gulpTransform())
    .pipe(gulp.dest(`dist/components${componentName ? `/${componentName}` : ''}`)));

gulp.task('compile-templates:watch', () => watch([
  `src/components/${componentName || '*'}/*.view`,
  `src/components/${componentName || '*'}/*.js`
], { ignoreInitial: true })
  .pipe(gulpTransform())
  .pipe(gulp.dest(`dist/components${componentName ? `/${componentName}` : ''}`)));
