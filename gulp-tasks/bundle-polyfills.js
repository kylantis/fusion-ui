
const gulp = require('gulp');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const uglify = require('gulp-uglify');
// const sourcemaps = require('gulp-sourcemaps');
const log = require('gulplog');
const fs = require('fs');
const pathLib = require('path');

const alwaysGeneratePolyfillBundle = true;

gulp.task('bundle-polyfills', () => {

  const destFile = pathLib.join('dist', 'assets', 'js', 'polyfills');

  if (!alwaysGeneratePolyfillBundle) {
    if (fs.existsSync(pathLib.join(destFile, 'index.min.js'))) {
      // log.info('Skipping generation of polyfill bundle');
      return Promise.resolve();
    }
  }

  const entrypointFile = pathLib.join('gulp-tasks', 'polyfills', 'index.js');

  if (!fs.existsSync(entrypointFile)) {
    throw Error('Could not find the entrypoint file for polyfills');
  }

  // set up the browserify instance on a task basis
  const b = browserify({
    entries: entrypointFile,
    debug: true,
  });

  return b.bundle()
    .pipe(source('index.min.js'))
    .pipe(buffer())
    // .pipe(sourcemaps.init({ loadMaps: true }))
    // Add transformation tasks to the pipeline here.
    .pipe(uglify())
    .on('error', log.error)
    // .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(destFile));
});
