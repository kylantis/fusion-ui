
const fs = require('fs');
const pathLib = require('path');
const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const through = require('through2');
const utils = require('../lib/utils');
const srcFolder = 'src/assets/scss';
const destFolder = 'dist/assets/styles';

const globPattern = `${srcFolder}/**/*.scss`;

const compressTransform = () => through.obj((chunk, enc, cb) => {
  const vinylFile = chunk.clone();

  const { contents, path } = vinylFile;
  const _path = path.replace(srcFolder, destFolder);

  const dir = pathLib.dirname(_path);
  fs.mkdirSync(dir, { recursive: true });

  utils.getCompressedFiles(_path, contents)
    .forEach(([p, c]) => {
      fs.writeFileSync(p, c)
    });

  cb(null, vinylFile);
});

const addPipes = (path, relativize) => {
  let stream = gulp.src(path);

  if (relativize) {
    stream = stream.pipe(
      through.obj((chunk, enc, cb) => {
        const vinylFile = chunk.clone();
        vinylFile.base = pathLib.join(process.cwd(), srcFolder);
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
    .pipe(rename({ suffix: '.min' }))
    .pipe(compressTransform())
    .pipe(gulp.dest(destFolder));
};

gulp.task('compile-styles', () => addPipes(globPattern));

gulp.task('compile-styles:watch', () => {
  const watcher = gulp.watch(globPattern, { ignoreInitial: true })

  watcher.on('change', (path) => addPipes(path, true));
});
