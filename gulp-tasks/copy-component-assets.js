
const fs = require('fs');
const pathLib = require('path');
const gulp = require('gulp');
const through = require('through2');
const brotli = require('brotli-wasm');

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

gulp.task(
  'copy-component-assets', () => gulp.src([`${srcFolder}/**/assets/*`])
    .pipe(renameComponentAssetId())
    .pipe(brotliTransform())
    .pipe(gulp.dest(destFolder))
);


