
const fs = require('fs');
const pathLib = require('path');
const gulp = require('gulp');
const through = require('through2');
const utils = require('../lib/utils');

const srcFolder = 'src/components';
const destFolder = 'dist/components';

const renameComponentAssetId = () => {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    const [componentsFolder] = pathLib.relative(srcFolder, file.path).split('/');
    const assetId = componentsFolder.replace(/-/g, '_');

    file.path = file.path.replace(`${srcFolder}/${componentsFolder}`, `${srcFolder}/${assetId}`);
    callback(null, file);
  });
}

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

gulp.task(
  'copy-component-assets', () => gulp.src([`${srcFolder}/**/assets/**/*.*`])
    .pipe(renameComponentAssetId())
    .pipe(compressTransform())
    .pipe(gulp.dest(destFolder))
);


