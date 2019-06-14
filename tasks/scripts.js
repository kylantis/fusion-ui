/**
 * Gulp stylesheets task file
 * compiles all script files, then minify into dist folder
 */

const gulp = require('gulp');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const babel = require('gulp-babel');
const rename = require('gulp-rename');

const babelConfig = {
  presets: ['@babel/preset-env'],
};
const renameConfig = {
  suffix: '.min',
};

gulp.task('scripts', () => gulp.src('src/**/*.js')
  .pipe(babel(babelConfig))
  .pipe(uglify({
    mangle: true,
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
