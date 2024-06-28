
const pathLib = require('path');
const gulp = require('gulp');
const through = require('through2');

const srcFolder = 'src/components';
const distFolder = 'dist/components';

const renameComponentAssetId = () => {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    const dir = pathLib.dirname(file.path);
    const componentsFolder = pathLib.dirname(dir);

    const assetId = pathLib.relative(componentsFolder, dir)
      .replace(/-/g, '_');

    file.path = pathLib.join(componentsFolder, assetId, file.basename);
    callback(null, file);
  });
}

gulp.task(
  'copy-component-scripts', () => gulp.src(
    [`${srcFolder}/**/*.js`, `!${srcFolder}/**/index.js`, `!${srcFolder}/**/index.test.js`]
  )
    .pipe(renameComponentAssetId())
    .pipe(gulp.dest(distFolder))
);


