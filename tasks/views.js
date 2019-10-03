/**
 * Gulp views task file
 * Copies all views to the public folder
 */

const gulp = require('gulp');
const watch = require('gulp-watch');

gulp.task('views', () => gulp.src(['src/**/*.html'])
  .pipe(gulp.dest('./dist/')));


gulp.task('views:watch', () => watch('src/**/*.html', { ignoreInitial: false })
  .pipe(gulp.dest('./dist/')));
