
const pathLib = require('path');
const gulp = require('gulp');
const through = require('through2');

const srcFolder = 'src/components';
const distFolder = 'dist/components';

const renameComponentAssetId = () => {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    const [componentsFolder] = pathLib.relative(srcFolder, file.path).split('/');
    const assetId = componentsFolder.replace(/-/g, '_');

    file.path = file.path.replace(`${srcFolder}/${componentsFolder}`, `${srcFolder}/${assetId}`);
    callback(null, file);
  });
}

gulp.task(
  'copy-component-assets', () => gulp.src([`${srcFolder}/**/assets/**`])
    .pipe(renameComponentAssetId())
    .pipe(gulp.dest(distFolder))
);


