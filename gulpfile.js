
const gulp = require('gulp');

require('require-dir')('tasks');

gulp.task('dist', gulp.series('minify-images', 'copy-assets', 'compile-syles', 'compile-scripts', 'compile-components', 'scan-ctags', 'bundle-polyfills', 'compile-templates', (callback) => {
  callback();
}));


gulp.task('dev', gulp.parallel('minify-images:watch', 'copy-assets:watch', 'compile-syles:watch', 'compile-scripts:watch', 'compile-components:watch', 'scan-ctags', 'bundle-polyfills', 'compile-templates:watch', (callback) => {
  callback();
}));
