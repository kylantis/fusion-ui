
const gulp = require('gulp');

require('require-dir')('gulp-tasks');

gulp.task('build', gulp.series('copy-enums', 'copy-assets', 'minify-images', 'minify-icons', 'copy-component-assets', 'compile-styles', 'compile-component-styles', 'compile-scripts', 'compile-components', 'minify-component-icons', 'generate-client-bundles'));

gulp.task('watch', gulp.parallel('copy-enums:watch', 'compile-styles:watch', 'compile-component-styles:watch', 'compile-scripts:watch', 'compile-components:watch'));
