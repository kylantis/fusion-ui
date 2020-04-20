/**
 * Gulp views task file
 * Copies all views to the public folder
 */

const gulp = require('gulp');
const watch = require('gulp-watch');

gulp.task('copy-assets', () => gulp.src('src/**/*.json')
  .pipe(gulp.dest('./dist/')));


gulp.task('copy-assets:watch', () => watch('src/**/*.json', { ignoreInitial: false })
  .pipe(gulp.dest('./dist/')));
