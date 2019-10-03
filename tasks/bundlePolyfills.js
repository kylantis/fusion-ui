
const gulp = require('gulp');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const uglify = require('gulp-uglify');
// const sourcemaps = require('gulp-sourcemaps');
const log = require('gulplog');
const fs = require('fs');
const path = require('path');

const alwaysGeneratePolyfillBundle = true;

gulp.task('bundlePolyfills', () => {
  if (!alwaysGeneratePolyfillBundle) {
    const polyfillBundle = path.join(path.dirname(fs.realpathSync(__filename)), '../dist/assets/js/polyfills/index.min.js');
    if (fs.existsSync(polyfillBundle)) {
      log.info('Skipping generation of polyfill bundle');
      return Promise.resolve();
    }
  }

  // set up the browserify instance on a task basis
  const b = browserify({
    entries: 'tasks/polyfills/index.js',
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
    .pipe(gulp.dest('./dist/assets/js/polyfills'));
});
