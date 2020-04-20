/**
 * Gulp stylesheets task file
 */

const gulp = require('gulp');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const watch = require('gulp-watch');

const renameConfig = {
  suffix: '.min',
};
gulp.task('compile-syles', () => gulp.src('src/assets/scss/**/*.scss')
  .pipe(sass(
    {
      outputStyle: 'compressed',
      includePaths: ['node_modules/normalize-scss/sass/'],
    },
  ).on('error', sass.logError))

  .pipe(rename(renameConfig))
  .pipe(gulp.dest('dist/assets/css')));

gulp.task('compile-syles:watch', () => watch('src/assets/scss/**/*.scss', { ignoreInitial: false })
  .pipe(sourcemaps.init())
  .pipe(sass(
    {
      outputStyle: 'expanded',
      includePaths: ['node_modules/normalize-scss/sass/'],
    },
  ).on('error', sass.logError))
  .pipe(sourcemaps.write())
  .pipe(rename(renameConfig))
  .pipe(gulp.dest('dist/assets/css')));
