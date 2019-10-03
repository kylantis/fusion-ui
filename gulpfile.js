
const gulp = require('gulp');

require('require-dir')('tasks');

gulp.task('dist', gulp.parallel('images', 'views', 'scss', 'scripts', 'scanCtags', 'bundlePolyfills', (callback) => {
  callback();
}));


gulp.task('dev', gulp.parallel('images:watch', 'views:watch', 'scss:watch', 'scripts', 'components:watch', 'scanCtags', 'bundlePolyfills', (callback) => {
  callback();
}));
