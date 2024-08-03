
const fs = require('fs');
const pathLib = require('path');
const { spawn } = require('child_process');
const gulp = require('gulp');
const through = require('through2');
const utils = require('../lib/utils');

const { processFile } = require('../lib/template-processor');

const componentNameArgPrefix = '--component=';
const segmentArg = '--segment';
const performPurgeArg = '--performPurge';
const fromWatchArg = '--fromWatch';

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
          'npm', ['run', 'compile-component', '--silent', '--', '--silent', ...args],
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
    const args = [`${componentNameArgPrefix}${componentName}`, segmentArg, fromWatchArg];

    const childProcess = spawn(
      'npm', ['run', 'compile-component', '--silent', '--', '--silent', ...args],
      { stdio: "inherit" }
    );

    childProcess.on('exit', () => {
      global.__cwp = false;
    });
  });
});
