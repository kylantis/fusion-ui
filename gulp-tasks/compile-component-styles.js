/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const fs = require('fs');
const pathLib = require('path');
const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const through = require('through2');
const gulpif = require('gulp-if');
const streamCombiner = require('stream-combiner2');
const utils = require('../lib/utils');

const srcFolder = 'src/components';
const destFolder = 'dist/components';

const globPattern = `${srcFolder}/**/style.scss`;

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

  const isScssFile = (vinylFile) => vinylFile.path.endsWith('.scss');

  return stream
    .pipe(
      gulpif(
        isScssFile,
        streamCombiner.obj(
          sourcemaps.init(),
          sass(
            {
              outputStyle: 'compressed',
              includePaths: ['node_modules/normalize-scss/sass/'],
            },
          ).on('error', sass.logError),
          sourcemaps.write(),
          rename({ suffix: '.min' })
        ),
      )
    )
    .pipe(renameComponentAssetId())
    .pipe(compressTransform())
    .pipe(gulp.dest(destFolder))
};

gulp.task('compile-component-styles', () => addPipes(globPattern));

gulp.task('compile-component-styles:watch', () => {
  const watcher = gulp.watch(
    globPattern, { ignoreInitial: true }
  );

  watcher.on('change', (path) => addPipes(path, true));
});
