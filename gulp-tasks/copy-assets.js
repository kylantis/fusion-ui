
const fs = require('fs');
const pathLib = require('path');
const gulp = require('gulp');
const through = require('through2');
const brotli = require('brotli-wasm');

const removeInternalSegment = () => {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    file.path = file.path.replace('/__internal', '');
    callback(null, file);
  });
}

const brotliTransform = (srcFolder = 'src', destFolder = 'dist') => through.obj((chunk, enc, cb) => {
  const vinylFile = chunk.clone();

  const { contents, path, basename } = vinylFile;
  const _path = path.replace(srcFolder, destFolder);

  const dir = pathLib.dirname(_path);
  fs.mkdirSync(dir, { recursive: true });

  if (!basename.includes('brotli')) {
    fs.writeFileSync(
      `${_path}.br`,
      brotli.compress(contents)
    );
  }

  cb(null, vinylFile);
});

gulp.task('copy-fonts', () => gulp.src(['src/assets/fonts/**'])
  .pipe(gulp.dest('dist/assets/fonts/')));

gulp.task('copy-styles', () => gulp.src(['src/assets/styles/*'])
  .pipe(brotliTransform())
  .pipe(gulp.dest('dist/assets/styles/')));

gulp.task('copy-scripts', () => gulp.src(['src/assets/js/**/*.min.js'])
  .pipe(removeInternalSegment())
  .pipe(brotliTransform())
  .pipe(gulp.dest('dist/assets/js/')));

gulp.task('copy-scripts-data', () => gulp.src(['src/assets/js/data/*'])
  .pipe(removeInternalSegment())
  .pipe(brotliTransform())
  .pipe(gulp.dest('dist/assets/js/data/')));

gulp.task('copy-pages', () => gulp.src(['src/assets/pages/**/*.html'])
  .pipe(removeInternalSegment())
  .pipe(brotliTransform())
  .pipe(gulp.dest('dist/assets/pages/')));

gulp.task(
  'copy-assets',
  gulp.series('copy-fonts', 'copy-styles', 'copy-scripts', 'copy-scripts-data', 'copy-pages', (callback) => {
    callback();
  })
);
