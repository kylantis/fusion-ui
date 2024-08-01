
const fs = require('fs');
const pathLib = require('path');
const gulp = require('gulp');
const through = require('through2');
const brotli = require('brotli-wasm');

const srcFolder = 'src/components';
const destFolder = 'dist/components';

const srcFile = `${srcFolder}/enums.json`;

const brotliTransform = () => through.obj((chunk, enc, cb) => {
  const vinylFile = chunk.clone();

  const { contents, path } = vinylFile;
  const _path = path.replace(srcFolder, destFolder);

  const dir = pathLib.dirname(_path);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(
    `${_path}.br`,
    brotli.compress(contents)
  );

  cb(null, vinylFile);
});

const fn = () => gulp.src([srcFile])
  .pipe(brotliTransform())
  .pipe(gulp.dest(destFolder));

gulp.task('copy-enums', fn);

gulp.task('copy-enums:watch', () => {
  const watcher = gulp.watch(
    [srcFile],
    { ignoreInitial: true },
  )

  watcher.on('change', fn);
});
