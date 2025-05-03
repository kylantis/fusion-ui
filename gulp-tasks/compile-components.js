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
const { spawn } = require('child_process');
const gulp = require('gulp');
const through = require('through2');
const utils = require('../lib/utils');

const { processFile } = require('../lib/template-processor');
const TemplatePreprocessor = require('../lib/template-preprocessor');

const componentNameArgPrefix = '--component=';
const segmentArg = '--segment';
const performPurgeArg = '--performPurge';
const fromWatchArg = '--fromWatch';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

let componentName;
let componentList;
let performPurge;
let fromWatch;

const processNodeArgs = () => {
  const args = process.argv.slice(3);

  for (const arg of args) {
    switch (true) {
      case arg.startsWith(componentNameArgPrefix):
        componentName = arg.replace(componentNameArgPrefix, '');
        break;
      case arg == segmentArg:
        componentList = utils.getAllComponentNames();
        break;
      case arg == performPurgeArg:
        performPurge = true;
        break;
      case arg == fromWatchArg:
        fromWatch = true;
        break;
      case arg == '--':
        return;
    }
  }
}

processNodeArgs();

if (!componentList) {
  componentList = componentName ? [componentName] : utils.getAllComponentNames();
}

const srcFolder = 'src/components';
const destFolder = 'dist/components';

// eslint-disable-next-line func-names
const gulpTransform = ({ componentList, performPurge } = {}) => {
  return through.obj(async function (vinylFile, _encoding, callback) {
    const file = vinylFile.clone();
    const dir = pathLib.dirname(file.path);

    if (fs.existsSync(pathLib.join(dir, '.skip'))) {
      this.destroy();
      return callback();
    }

    if (performPurge) {
      // prune the list.json file inorder to clear the component cache

      const file = pathLib.join(process.env.PWD, destFolder, 'list.json');
      if (fs.existsSync(file)) {
        fs.rmSync(file);
      }
    }

    const { assetId, metadata, error = null } = await processFile({
      dir,
      fromGulp: true,
      fromWatch,
      srcComponentList: componentList,
    });

    // write precompiled template
    file.basename = 'metadata.min.js';
    file.path = pathLib.join(pathLib.dirname(dir), assetId, file.basename);
    // eslint-disable-next-line no-buffer-constructor
    file.contents = Buffer.from(metadata || '');

    callback(fromWatch ? null : error, file);
  });
};

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

gulp.task('compile-component', async () => {
  const process = require('process');

  if (process) {
    process.on('uncaughtException', (err) => {
      console.error(err.stack);
      process.exit(1);
    });
  }

  if (!componentName) {
    throw Error(`Required argument: ${componentNameArgPrefix}`)
  }

  const viewFile = pathLib.join(srcFolder, componentName, 'index.view');

  if (!fs.existsSync(viewFile)) {
    throw Error(`Could not find view file "${viewFile}"`)
  }

  return gulp.src(viewFile)
    .pipe(
      gulpTransform({ componentList, performPurge })
    )
    .pipe(compressTransform())
    .pipe(gulp.dest(pathLib.join(destFolder, componentName)))
    .on('end', () => {
      process.exit(0);
    });
});

gulp.task('compile-components', gulp.series(componentList
  .map((name, i) => {
    const taskName = `compile-component-${name}`;

    const args = [`${componentNameArgPrefix}${name}`, segmentArg];

    if (i == 0) {
      args.push(performPurgeArg);
    }

    gulp.task(taskName, () => {
      return new Promise((resolve, reject) => {

        const childProcess = spawn(
          npmCommand, ['run', 'compile-component', '--silent', '--', '--silent', ...args],
          { stdio: "inherit" }
        );

        childProcess.on('close', (code) => {
          if (code == 0) {
            resolve();
          } else {
            const err = Error(`Exception thrown while running ${taskName}, see above for stack trace`);
            err.stack = ' ';
            reject(err);
          }
        });
      })
    });

    return taskName;
  })));

gulp.task('compile-components:watch', () => {
  const watcher = gulp.watch(
    [
      pathLib.join(srcFolder, componentName || '*', '*.view'),
      pathLib.join(srcFolder, componentName || '*', '*.js')
    ],
    { ignoreInitial: true },
  )

  watcher.on('change', (path) => {
    if (global.__cwp) return;

    global.__cwp = true;

    const [componentName] = path.replace(`${srcFolder}/`, '').split('/');

    if (path.endsWith('.js')) {
      const { 
        getComponentJsAstFile, getComponentListPath, getComponentDistConfigPath, loadCompiledComponentClasses,
        writeComponentJsToFileSystem, addGlobals
      } = TemplatePreprocessor;

      const assetId = componentName.replace(/-/g, '_');
      const astFile = getComponentJsAstFile(assetId);

      if (fs.existsSync(astFile)) {
        const srcDir = pathLib.join(process.env.PWD, srcFolder, componentName);

        console.info(`\x1b[90m[writeComponentJsToFileSystem: ${srcDir}]\x1b[0m`);

        const componentList = JSON.parse(fs.readFileSync(getComponentListPath(), 'utf8'));
        const { parents } = JSON.parse(fs.readFileSync(getComponentDistConfigPath(assetId), 'utf8'));

        const _componentList = {};

        for (let i = parents.length - 1; i >= 0; i--) {
          const p = parents[i];
          _componentList[p] = componentList[p];
        }

        addGlobals();

        loadCompiledComponentClasses(_componentList);

        const componentAst = JSON.parse(fs.readFileSync(astFile, 'utf8'));

        writeComponentJsToFileSystem({
          srcDir, assetId, componentAst,
        });

        console.info(`\x1b[90mcompleted\x1b[0m`);

        global.__cwp = false;
        return;
      }
    }

    const args = [`${componentNameArgPrefix}${componentName}`, segmentArg, fromWatchArg];

    const childProcess = spawn(
      npmCommand, ['run', 'compile-component', '--silent', '--', '--silent', ...args],
      { stdio: "inherit" }
    );

    childProcess.on('exit', () => {
      global.__cwp = false;
    });
  });
});
