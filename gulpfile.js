
const gulp = require('gulp');

require('require-dir')('tasks');

// gulp.task('dist', gulp.parallel('images', 'views', 'scss', 'scripts', 'scan-ctags', 'bundle-polyfills', 'compile-templates', (callback) => {
//   callback();
// }));


// gulp.task('dev', gulp.parallel('images:watch', 'views:watch', 'scss:watch', 'scripts', 'components:watch', 'scan-ctags', 'bundle-polyfills', 'compile-templates:watch', (callback) => {
//   callback();
// }));

gulp.task('dist', gulp.parallel('compile-templates', (callback) => {
  callback();
}));


gulp.task('dev', gulp.parallel('compile-templates:watch', (callback) => {
  callback();
}));
