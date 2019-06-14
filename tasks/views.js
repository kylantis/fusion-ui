/**
 * Gulp views task file
 * Copies all views to the public folder
 */

const gulp = require('gulp');

gulp.task('views', () => gulp.src(['src/**/*.html'])
  .pipe(gulp.dest('./dist/')));

gulp.task('views:watch', () => {
  gulp.watch(['src/**/*.html'], { ignoreInitial: false }, gulp.series('views'));
});
