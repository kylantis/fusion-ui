
const gulp = require('gulp');

require('require-dir')('tasks');

gulp.task('dist-templates', gulp.series('compile-templates', (callback) => {
  callback();
}));

gulp.task('watch-templates', gulp.series('compile-templates:watch', (callback) => {
  callback();
}));

gulp.task('dist', gulp.series('minify-images', 'compile-syles', 'compile-scripts', 'bundle-polyfills', 'compile-templates', (callback) => {
  callback();
}));


gulp.task('watch', gulp.parallel('minify-images:watch', 'compile-syles:watch', 'compile-scripts:watch', 'bundle-polyfills', 'compile-templates:watch', (callback) => {
  callback();
}));
