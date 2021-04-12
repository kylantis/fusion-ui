/**
 * Gulp stylesheets task file
 */

const gulp = require('gulp');

gulp.task('copy-fonts', () => gulp.src(['src/assets/fonts/**'])
  .pipe(gulp.dest('dist/assets/fonts/')));

gulp.task('copy-styles', () => gulp.src(['src/assets/styles/*'])
  .pipe(gulp.dest('dist/assets/styles/')));

gulp.task('copy-scripts', () => gulp.src(['src/assets/js/**/*.min.js'])
  .pipe(gulp.dest('dist/assets/js/')));

gulp.task('copy-enums', () => gulp.src(['src/components/enums.json'])
  .pipe(gulp.dest('dist/components/')));

gulp.task(
  'copy-assets', 
  gulp.series('copy-fonts', 'copy-styles', 'copy-scripts', 'copy-enums', (callback) => {
  callback();
}));
