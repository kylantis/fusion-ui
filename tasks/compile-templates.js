/* eslint-disable no-undef */
/* eslint-disable no-console */
const gulp = require('gulp');
const path = require('path');
const fs = require('fs');
const watch = require('gulp-watch');
const through = require('through2');
const log = require('fancy-log');
const { processFile } = require('../lib/template-processor');
const Preprocessor = require('../lib/template-preprocessor');

// eslint-disable-next-line func-names
const gulpTransform = function () {
  return through.obj((vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();
    log.info(`\x1b[32m[Processing ${file.path}]\x1b[0m`);

    const dir = path.dirname(file.path);

    if (fs.existsSync(path.join(dir, '.skip'))) {
      // Todo: remove this, and find a proper fix
      // return callback(null, file);
    }

    processFile({
      dir,
      fromGulp: true,
      Preprocessor,
    }).then(({ assetId, templateData }) => {
      // write precompiled template
      file.basename = 'template.min.js';
      file.path = path.join(path.dirname(path.dirname(file.path)), assetId, file.basename);
      // eslint-disable-next-line no-buffer-constructor
      file.contents = Buffer.from(templateData);

      callback(null, file);
    });
  });
};

gulp.task('compile-templates',
  () => gulp.src(['src/components/**/template.hbs'])
    .pipe(gulpTransform())
    .pipe(gulp.dest('dist/components')));

gulp.task('compile-templates:watch', () => watch(['src/components/**/*.hbs', 'src/components/**/*.js'], { ignoreInitial: true })
  .pipe(gulpTransform())
  .pipe(gulp.dest('dist/components')));
