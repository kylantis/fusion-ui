/* eslint-disable no-undef */
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const { Worker } = require("worker_threads");

const gulp = require('gulp');
const watch = require('gulp-watch');
const through = require('through2');
const log = require('fancy-log');

const Preprocessor = require('../lib/template-preprocessor');
const { processFile } = require('../lib/template-processor');

// eslint-disable-next-line func-names
const gulpTransform = function ({ fromWatch = false } = {}) {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();
    log.info(`\x1b[32m[Processing started for ${file.path}]\x1b[0m`);

    const dir = path.dirname(file.path);

    if (fs.existsSync(path.join(dir, '.skip'))) {
      // Todo: remove this, and find a proper fix
      // return callback(null, file);
    }

    let promise;

    if (fromWatch) {

      const worker = new Worker("./tasks/lib/process_file_worker.js", { workerData: { num: 1 } });
      worker.postMessage({
        dir,
        fromGulp: true,
      });

      promise = new Promise((resolve, reject) => {
        worker.on('message', (msg) => {
          resolve(msg);
        });
      })

    } else {
      
      promise = processFile({
        dir,
        fromGulp: true,
        Preprocessor,
      });
    }

    return promise.then(({ assetId, metadata }) => {
      // write precompiled template
      file.basename = 'metadata.min.js';
      file.path = path.join(path.dirname(path.dirname(file.path)), assetId, file.basename);
      // eslint-disable-next-line no-buffer-constructor
      file.contents = Buffer.from(metadata || '');

      if (metadata) {
        log.info(`\x1b[32m[Processing completed]\x1b[0m`);
      }

      callback(null, file);
    });
  });
};

const componentArgPrefix = '--component=';
const tailArgument = process.argv[process.argv.length - 1];

const componentName = tailArgument.startsWith(componentArgPrefix) ?
  tailArgument.replace(componentArgPrefix, '') : null;

gulp.task('compile-templates',
  () => gulp.src([`src/components/${componentName || '**'}/index.view`])
    .pipe(gulpTransform())
    .pipe(gulp.dest(`dist/components${componentName ? `/${componentName}` : ''}`)));

gulp.task('compile-templates:watch', () => watch([
  `src/components/${componentName || '**'}/*.view`,
  `src/components/${componentName || '**'}/*.js`
], { ignoreInitial: true })
  .pipe(gulpTransform({ fromWatch: true }))
  .pipe(gulp.dest(`dist/components${componentName ? `/${componentName}` : ''}`)));
