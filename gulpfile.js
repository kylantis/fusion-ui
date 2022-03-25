
const gulp = require('gulp');

require('require-dir')('tasks');

gulp.task('dist-all', gulp.series('copy-assets', 'minify-images', 'minify-icons', 'bundle-polyfills', 'compile-syles', 'compile-component-syles', 'compile-scripts', 'compile-components', 'minify-component-icons', (callback) => {
  callback();
}));

gulp.task('dist', gulp.series('copy-enums', 'compile-syles', 'compile-scripts', 'compile-component-syles', 'compile-components', (callback) => {
  callback();
}));

gulp.task('watch', gulp.parallel('compile-syles:watch', 'compile-component-syles:watch', 'compile-scripts:watch', 'compile-components:watch', (callback) => {
  callback();
}));
