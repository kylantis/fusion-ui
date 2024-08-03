
const fs = require('fs');
const pathLib = require('path');
const gulp = require('gulp');
const through = require('through2');
const utils = require('../lib/utils');

const srcFolder = 'src/components';
const destFolder = 'dist/components';

const srcFile = `${srcFolder}/enums.json`;

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

const fn = () => gulp.src([srcFile])
  .pipe(compressTransform())
  .pipe(gulp.dest(destFolder));

gulp.task('copy-enums', fn);

gulp.task('copy-enums:watch', () => {
  const watcher = gulp.watch(
    [srcFile],
    { ignoreInitial: true },
  )

  watcher.on('change', fn);
});
