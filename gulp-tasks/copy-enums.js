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
