
const gulp = require('gulp');

require('require-dir')('gulp-tasks');

gulp.task('build', gulp.series('copy-enums', 'copy-assets', 'copy-component-assets', 'compile-styles', 'compile-component-styles', 'compile-scripts', 'compile-components', 'generate-client-bundles'));

gulp.task('watch', gulp.parallel('copy-enums:watch', 'compile-styles:watch', 'compile-component-styles:watch', 'compile-scripts:watch', 'compile-components:watch'));
