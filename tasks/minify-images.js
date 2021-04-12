
/**
 * Gulp images task file
 * Optimize Images task
 */

const gulp = require('gulp');
const imageMin = require('gulp-imagemin');
const watch = require('gulp-watch');

gulp.task('minify-images', () => gulp.src('src/assets/images/**/*.{png,svg,ico,gif,jpg,webp}')
  // Todo: find an alternative, as this is not correctly processing
  // SVG files

  // .pipe(imageMin({
  //   progressive: true,
  //   interlaced: true,
  //   svgoPlugins: [{ removeViewBox: false }, { removeUselessStrokeAndFill: false }],
  // }))
  .pipe(gulp.dest('dist/assets/images/')));

gulp.task('minify-icons', () => gulp.src('src/assets/icons/**/*.{png,svg,ico,gif,jpg,webp}')
  // Todo: find an alternative, as this is not correctly processing
  // SVG files

  // .pipe(imageMin({
  //   progressive: true,
  //   interlaced: true,
  //   svgoPlugins: [{ removeViewBox: false }, { removeUselessStrokeAndFill: false }],
  // }))
  .pipe(gulp.dest('dist/assets/icons/')));

gulp.task('minify-component-icons', () => gulp.src('src/components/**/icon.{png,svg,ico,gif,jpg,webp}')
  // Todo: find an alternative, as this is not correctly processing
  // SVG files

  // .pipe(imageMin({
  //   progressive: true,
  //   interlaced: true,
  //   svgoPlugins: [{ removeViewBox: false }, { removeUselessStrokeAndFill: false }],
  // }))
  .pipe(gulp.dest('dist/components')));
