/**
 * Gulp stylesheets task file
 */

const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const through = require('through2');
const pathLib = require('path');



const renameConfig = {
  suffix: '.min',
};

const srcFolder = 'src/assets/scss';
const watchTarget = `${srcFolder}/**/*.scss`;

const distFolder = 'dist/assets/styles';


const addPipes = (path, relativize) => {
  let stream = gulp.src(path);

  if (relativize) {
    stream = stream.pipe(
      through.obj((chunk, enc, cb) => {
        const vinylFile = chunk.clone();
        vinylFile.base = pathLib.join(process.env.PWD, srcFolder);
        cb(null, vinylFile);
      })
    );
  }

  return stream
    .pipe(sourcemaps.init())
    .pipe(sass(
      {
        outputStyle: 'compressed',
        includePaths: ['node_modules/normalize-scss/sass/'],
      },
    ).on('error', sass.logError))
    .pipe(sourcemaps.write())
    .pipe(rename(renameConfig))
    .pipe(gulp.dest(distFolder));
};

gulp.task('compile-syles', () => addPipes(watchTarget));

gulp.task('compile-syles:watch', () => {
  const watcher = gulp.watch(watchTarget, { ignoreInitial: true })

  watcher.on('change', (path) => addPipes(path, true));
});
