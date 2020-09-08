/**
 * Gulp stylesheets task file
 * compiles all script files, then minify into dist folder
 * @author Tony
 */
const fs = require('fs');
const babel = require('@babel/core');
const gulp = require('gulp');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const watch = require('gulp-watch');
const log = require('fancy-log');

const through = require('through2');

/**
 *
 * We are currently not using core-js ES polyfills, even though we actually should be
 * doing so, for complete es.next support, hence we set useBuiltIns: 'false'. The reason for
 * this is using core-js polyfills (setting useBuiltIns: 'usage') would mean that each js
 * artifact would include a "require" for the polyfill in core-js which would then
 * mandate us to use a code bundler i.e browserify
 *
 * Now doing a require in the browser is not actually a problem, since browserify can inline
 * the "require"d assets. The problem however is we don't have a scalable stategy to make
 * this work because file sizes would be over-bloated, and this is way beyond our perf budget
 *
 * In light of this, we are preventing babel from adding a require, hence developers should
 * ensure that: Javascript Classes used are supported by most browsers out the box
 * Note: this does not include es.next syntax(es)
 *
 * When we we find a way to properly bundle our js artifact(s), see the answer provided here:
 * https://stackoverflow.com/questions/33187695/gulp-babelify-browserify-issue
 */

const renameConfig = {
  suffix: '.min',
};

const babelTransform = through.obj((vinylFile, encoding, callback) => {
  const file = vinylFile.clone();
  const filePath = `${file.base}/${file.relative}`;
  const result = babel.transformSync(fs.readFileSync(filePath, 'utf8'));
  file.contents = Buffer.from(result.code);
  callback(null, file);
});

gulp.task('compile-scripts', () => gulp.src(['src/assets/js/**/*.js'])
  .pipe(babelTransform)
  .pipe(sourcemaps.init())
  .pipe(uglify({
    mangle: false,
    compress: true,
  }).on('error', (msg) => {
    log.error(msg);
  }))
  .pipe(sourcemaps.write())
  .pipe(rename(renameConfig))
  .pipe(gulp.dest('./dist/assets/js')));


gulp.task('compile-scripts:watch', () => watch(['src/assets/js/**/*.js'], { ignoreInitial: true })
  .pipe(babelTransform)
  .pipe(sourcemaps.init())
  .pipe(uglify({
    mangle: false,
    compress: true,
  }).on('error', (msg) => {
    log.error(msg);
  }))
  .pipe(sourcemaps.write())
  .pipe(rename(renameConfig))
  .pipe(gulp.dest('./dist/assets/js')));
