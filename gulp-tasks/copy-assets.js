/**
 * Gulp stylesheets task file
 */

const gulp = require('gulp');
const through = require('through2');

const removeInternalSegment = () => {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    file.path = file.path.replace('/__internal', '');
    callback(null, file);
  });
}

gulp.task('copy-fonts', () => gulp.src(['src/assets/fonts/**'])
  .pipe(gulp.dest('dist/assets/fonts/')));

gulp.task('copy-styles', () => gulp.src(['src/assets/styles/*'])
  .pipe(gulp.dest('dist/assets/styles/')));

gulp.task('copy-scripts', () => gulp.src(['src/assets/js/**/*.min.js'])
.pipe(removeInternalSegment())
  .pipe(gulp.dest('dist/assets/js/')));

gulp.task('copy-pages', () => gulp.src(['src/assets/pages/**/*.html'])
  .pipe(removeInternalSegment())
  .pipe(gulp.dest('dist/assets/pages/')));

gulp.task(
  'copy-assets',
  gulp.series('copy-fonts', 'copy-styles', 'copy-scripts', 'copy-pages', (callback) => {
    callback();
  })
);
