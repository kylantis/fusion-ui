
const gulp = require('gulp');

require('require-dir')('gulp-tasks');

gulp.task('build', gulp.series('copy-enums', 'copy-assets', 'minify-images', 'minify-icons', 'copy-component-assets', 'compile-syles', 'compile-component-syles', 'compile-scripts', 'compile-components', 'minify-component-icons', 'generate-client-bundles'));

gulp.task('watch', gulp.parallel('copy-enums:watch', 'compile-syles:watch', 'compile-component-syles:watch', 'compile-scripts:watch', 'compile-components:watch'));
