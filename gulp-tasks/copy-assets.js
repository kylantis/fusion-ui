
const fs = require('fs');
const pathLib = require('path');
const gulp = require('gulp');
const through = require('through2');
const gulpif = require('gulp-if');
const utils = require('../lib/utils');

const srcFolder = 'src';
const destFolder = 'dist';

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

gulp.task('copy-fonts', () => gulp.src(['src/assets/fonts/**'])
  .pipe(gulp.dest('dist/assets/fonts/')));

gulp.task('copy-styles', () => gulp.src(['src/assets/styles/*'])
  .pipe(compressTransform())
  .pipe(gulp.dest('dist/assets/styles/')));

gulp.task('copy-scripts', () => gulp.src(['src/assets/js/**/*.min.js', 'src/assets/js/data/*'])
  .pipe(compressTransform())
  .pipe(gulp.dest('dist/assets/js/')));


const isSvgFile = ({ path }) => path.endsWith('.svg');

gulp.task('copy-images', () => gulp.src('src/assets/images/**/*.{png,svg,ico,gif,jpg,webp}')
  .pipe(
    gulpif(
      isSvgFile,
      compressTransform()
    )
  )
  .pipe(gulp.dest('dist/assets/images/')));

gulp.task('copy-icons', () => gulp.src('src/assets/icons/**/*.{png,svg,ico,gif,jpg,webp}')
  .pipe(
    gulpif(
      isSvgFile,
      // OR  ({ path }) => ['symbols-rtl.svg', 'symbols.svg'].includes(pathLib.basename(path)),
      compressTransform()
    )
  )
  .pipe(gulp.dest('dist/assets/icons/')));

gulp.task(
  'copy-assets',
  gulp.series('copy-fonts', 'copy-styles', 'copy-scripts', 'copy-images', 'copy-icons', (callback) => {
    callback();
  })
);
