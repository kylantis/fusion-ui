/**
 * Gulp stylesheets task file
 */
 const path = require('path');

const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const watch = require('gulp-watch');
const through = require('through2');

const renameConfig = {
  suffix: '.min',
};

const gulpTransform = () => {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    const dir = path.dirname(file.path);
    const componentsFolder = path.dirname(dir);

    const assetId = path.relative(componentsFolder, dir)
    .replace(/-/g, '_');

    file.path = path.join(componentsFolder, assetId, file.basename);
    callback(null, file);
  });
}


gulp.task('compile-component-syles', () => gulp.src('src/components/**/*.scss')
  .pipe(sass(
    {
      outputStyle: 'compressed',
      includePaths: ['node_modules/normalize-scss/sass/'],
    },
  ).on('error', sass.logError))

  .pipe(rename(renameConfig))
  .pipe(gulpTransform())
  .pipe(gulp.dest('dist/components')));

gulp.task('compile-component-syles:watch', () => watch('src/components/**/*.scss', { ignoreInitial: true })
  .pipe(sourcemaps.init())
  .pipe(sass(
    {
      outputStyle: 'expanded',
      includePaths: ['node_modules/normalize-scss/sass/'],
    },
  ).on('error', sass.logError))
  .pipe(sourcemaps.write())
  .pipe(rename(renameConfig))
  .pipe(gulpTransform())
  .pipe(gulp.dest('dist/components')));
