/**
 * Gulp stylesheets task file
 * compiles all script files, then minify into dist folder
 * @author Tony
 */

const gulp = require('gulp');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const babel = require('gulp-babel');
const rename = require('gulp-rename');

/**
 *
 * 1. We are currently not using core-js ES polyfills, even though we actually should be
 * doing so, for complete es.next support, hence we set useBuiltIns: 'false'. The reason for
 * this is using core-js polyfills (setting useBuiltIns: 'usage') would mean that each js
 * artifact would include a "require" for the polyfill in core-js which would then
 * mandate us to use a code bundler i.e browserify
 *
 * 2. We are currently not using async.. await.. on the client side because for babel
 * to polyfill this the npm package regenerator-runtime/runtime would need to be "require"d.
 *
 *
 * Now doing a require in the browser is not actually a problem, since browserify can inline
 * the "require"d assets. The problem however is we don't have a scalable stategy to make
 * this work because file sizes would be over-bloated, and this is way beyond our perf budget
 *
 * In light of this, we are preventing babel from adding a require, hence developers should
 * ensure that:
 * a. Javascript Classes used are supported by most browsers out the box
 *    Note: this does not include es.next syntax(es)
 * b. async..await.. should not be used
 *
 * When we we find a way to properly bundle our js artifact(s), see the answer provided here:
 * https://stackoverflow.com/questions/33187695/gulp-babelify-browserify-issue
 */

const babelConfig = {
  presets: [['@babel/env', {
    // corejs: {
    //   version: 3,
    //   proposals: true,
    // },
    useBuiltIns: 'false',
    // targets: {
    //   browsers: ['last 2 versions'],
    // },
    // debug: true,
  }],
  ],
};
const renameConfig = {
  suffix: '.min',
};

gulp.task('scripts', () => gulp.src('src/**/*.js')
  .pipe(babel(babelConfig))
  .pipe(uglify({
    mangle: true,
    compress: true,
  }).on('error', (msg) => {
    // eslint-disable-next-line no-console
    console.error(msg);
  }))
  .pipe(rename(renameConfig))
  .pipe(gulp.dest('./dist')));

gulp.task('scripts:dev', () => gulp.src('src/**/*.js')
  .pipe(babel(babelConfig))
  .pipe(sourcemaps.init())
  .pipe(uglify({
    mangle: false,
    compress: false,
  }).on('error', (msg) => {
    // eslint-disable-next-line no-console
    console.error(msg);
  }))
  .pipe(sourcemaps.write())
  .pipe(rename(renameConfig))
  .pipe(gulp.dest('./dist')));

gulp.task('scripts:watch', () => {
  gulp.watch(['src/**/*.js'], { ignoreInitial: false }, gulp.series('scripts:dev'));
});
