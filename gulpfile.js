
const gulp = require('gulp');

require('require-dir')('tasks');

gulp.task('distAll', gulp.series('copy-assets', 'minify-images', 'minify-icons', 'bundle-polyfills', 'compile-syles', 'compile-component-syles', 'compile-scripts', 'compile-components', 'minify-component-icons'));

gulp.task('dist', gulp.series('copy-enums', 'compile-syles', 'compile-scripts', 'compile-component-syles', 'compile-components'));

gulp.task('watch', gulp.parallel('compile-syles:watch', 'compile-component-syles:watch', 'compile-scripts:watch', 'compile-components:watch'));
