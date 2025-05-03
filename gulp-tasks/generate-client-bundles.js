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
const { build } = require('esbuild');
const utils = require('../lib/utils');

gulp.task('generate-client-bundles', async () => {

  const srcFolder = pathLib.resolve(__dirname, 'client-bundles');
  const entryPoints = fs.readdirSync(srcFolder).map(f => pathLib.join(srcFolder, f));

  const { outputFiles } = await build({
    entryPoints,
    bundle: true,
    minify: true,
    treeShaking: true,
    sourcemap: false,
    target: ['es2015'],
    alias: {
      'stream': 'stream-browserify',
    },
    outdir: 'dist/assets/js/client-bundles',
    write: false,
  });

  outputFiles.forEach(({ path, contents }, i) => {
    if (i == 0) {
      const dir = pathLib.dirname(path);
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(path, contents);

    utils.getCompressedFiles(path, contents)
      .forEach(([p, c]) => {
        fs.writeFileSync(p, c)
      });
  });

});