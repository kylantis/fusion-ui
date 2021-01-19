
const gulp = require('gulp');

require('require-dir')('tasks');

gulp.task('dist-templates', gulp.series('compile-templates', (callback) => {
  callback();
}));

gulp.task('watch-templates', gulp.series('compile-templates:watch', (callback) => {
  callback();
}));

gulp.task('dist-all', gulp.series('copy-assets', 'minify-images', 'minify-icons', 'bundle-polyfills', 'compile-syles', 'compile-scripts', 'compile-templates', (callback) => {
  callback();
}));

gulp.task('dist', gulp.series('compile-syles', 'compile-scripts', 'compile-templates', (callback) => {
  callback();
}));

gulp.task('watch', gulp.parallel('compile-syles:watch', 'compile-scripts:watch', 'compile-templates:watch', (callback) => {
  callback();
}));
