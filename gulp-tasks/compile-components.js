/* eslint-disable no-undef */
/* eslint-disable no-console */
const pathLib = require('path');
const fs = require('fs');

const { spawn } = require('child_process');

const gulp = require('gulp');
const through = require('through2');

const { processFile } = require('../lib/template-processor');
const { getAllComponentNames, peek } = require('../lib/utils');

const componentNameArgPrefix = '--component=';
const segmentArg = '--segment';
const performPurgeArg = '--performPurge';

let componentName;
let componentList;
let performPurge;

const nodeArgs = process.argv.slice(2);

const processNodeArgs = () => {
  nodeArgs.forEach(arg => {
    switch (true) {
      case arg.startsWith(componentNameArgPrefix):
        componentName = arg.replace(componentNameArgPrefix, '');
        break;
      case arg == segmentArg:
        componentList = getAllComponentNames();
        break;
      case arg == performPurgeArg:
        performPurge = true;
        break;
    }
  });
}

processNodeArgs();

if (!componentList) {
  componentList = componentName ? [componentName] : getAllComponentNames();
}

const srcFolder = 'src/components';
const distFolder = 'dist/components';

const __cpq = global.__cpq || (global.__cpq = []);

// eslint-disable-next-line func-names
const gulpTransform = ({ fromWatch, componentList, performPurge } = {}) => {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    const dir = pathLib.dirname(file.path);

    if (__cpq.length) {
      const dir = peek(__cpq);
      console.info(`Currently processing ${dir} - please try again shortly`);

      return callback(null, file);
    }

    if (fs.existsSync(pathLib.join(dir, '.skip'))) {
      return callback(null, file);
    }

    if (performPurge) {
      // prune the list.json file inorder to clear the component cache

      const file = pathLib.join(process.env.PWD, distFolder, 'list.json');
      if (fs.existsSync(file)) {
        fs.rmSync(file);
      }
    }

    __cpq.push(dir);

    const { assetId, metadata, error = null } = await processFile({
      dir,
      fromGulp: true,
      fromWatch,
      srcComponentList: componentList,
    });

    __cpq.pop();


    // write precompiled template
    file.basename = 'metadata.min.js';
    file.path = pathLib.join(pathLib.dirname(dir), assetId, file.basename);
    // eslint-disable-next-line no-buffer-constructor
    file.contents = Buffer.from(metadata || '');

    callback(fromWatch ? null : error, file);
  });
};

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

  return gulp.src(pathLib.join(srcFolder, componentName, 'index.view'))
    .pipe(
      gulpTransform({ componentList, performPurge })
    )
    .pipe(gulp.dest(pathLib.join(distFolder, componentName)))
});

gulp.task('compile-components', gulp.series(componentList
  .map((name, i) => {
    const taskName = `compile-component-${name}`;

    if (!componentName) {
      // We are compiling all components, we need to move each compilation task to a new process

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

    } else {
      // We are compiling only one component, [componentName]

      gulp.task(taskName, () => gulp.src(pathLib.join(srcFolder, name, 'index.view'))
        .pipe(
          gulpTransform({ componentList })
        )
        .pipe(gulp.dest(pathLib.join(distFolder, name)))
      )
    }

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
    gulp.src(path)
      .pipe(through.obj(async (chunk, enc, cb) => {
        const vinylFile = chunk.clone();
        vinylFile.base = pathLib.join(process.env.PWD, srcFolder);
        if (componentName) {
          vinylFile.base += `/${componentName}`;
        }
        cb(null, vinylFile);
      }))
      .pipe(gulpTransform({ fromWatch: true, performPurge: false }))

      .pipe(gulp.dest(`${distFolder}${componentName ? `/${componentName}` : ''}`))
  });
});
