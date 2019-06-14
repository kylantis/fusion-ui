/**
 * Gulp images task file
 * Optimize Images task
 */

const gulp = require('gulp');
const imageMin = require('gulp-imagemin');

gulp.task('images', () => gulp.src('src/assets/images/**/*.{png,svg,ico,gif,jpg,webp}')
  .pipe(imageMin({
    progressive: true,
    interlaced: true,
    svgoPlugins: [{ removeViewBox: false }, { removeUselessStrokeAndFill: false }],
  }))
  .pipe(gulp.dest('dist/assets/images/')));

gulp.task('images:dev', () => gulp.src('src/assets/images/**/*.{png,svg,ico,gif,jpg,webp}')
  .pipe(imageMin({
    progressive: true,
    interlaced: true,
    svgoPlugins: [{ removeViewBox: false }, { removeUselessStrokeAndFill: false }],
  }))
  .pipe(gulp.dest('dist/assets/images/')));

gulp.task('images:watch', () => {
  gulp.watch('src/assets/images/**/*.{png,svg,ico,gif,jpg,webp}', { ignoreInitial: false }, gulp.series('images:dev'));
});
