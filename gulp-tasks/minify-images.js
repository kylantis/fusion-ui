
/**
 * Gulp images task file
 * Optimize Images task
 */
const path = require('path');
const gulp = require('gulp');
const imageMin = require('gulp-imagemin');
const through = require('through2');

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
  .pipe(through.obj(async (vinylFile, _encoding, callback) => {

    // Transform component folder name with assetId, before piping
    // to the dist folder

    const file = vinylFile.clone();

    const dir = path.dirname(file.path);
    const componentsFolder = path.dirname(dir);

    const getAssetId = (name) => {
      if (name.includes('-')) {
        name = name.replace(/-/g, '_');
      }
      return name;
    }

    const assetId = getAssetId(path.relative(componentsFolder, dir));
    file.path = path.join(path.dirname(path.dirname(file.path)), assetId, file.basename);

    callback(null, file);
  }))
  .pipe(gulp.dest('dist/components')));
