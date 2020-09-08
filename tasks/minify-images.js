
/**
 * Gulp images task file
 * Optimize Images task
 */

const gulp = require('gulp');
const imageMin = require('gulp-imagemin');
const watch = require('gulp-watch');

gulp.task('minify-images', () => gulp.src('src/assets/images/**/*.{png,svg,ico,gif,jpg,webp}')
  .pipe(imageMin({
    progressive: true,
    interlaced: true,
    svgoPlugins: [{ removeViewBox: false }, { removeUselessStrokeAndFill: false }],
  }))
  .pipe(gulp.dest('dist/assets/images/')));

gulp.task('minify-images:watch', () => watch('src/assets/images/**/*.{png,svg,ico,gif,jpg,webp}', { ignoreInitial: true })
  .pipe(imageMin({
    progressive: true,
    interlaced: true,
    svgoPlugins: [{ removeViewBox: false }, { removeUselessStrokeAndFill: false }],
  }))
  .pipe(gulp.dest('dist/assets/images/')));
