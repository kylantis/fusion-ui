/* eslint-disable no-undef */
/* eslint-disable no-console */
const pathLib = require('path');
const fs = require('fs');

const gulp = require('gulp');
const through = require('through2');

const { processFile } = require('../lib/template-processor');
const { getAllComponentNames, peek } = require('../lib/utils');


const componentArgPrefix = '--component=';
const tailArgument = process.argv[process.argv.length - 1];

const componentName = tailArgument.startsWith(componentArgPrefix) ?
  tailArgument.replace(componentArgPrefix, '') : null;

const componentList = componentName ? [componentName] : getAllComponentNames();

const srcFolder = 'src/components';
const distFolder = 'dist/components';

const __cpq = global.__cpq || (global.__cpq = []);

// eslint-disable-next-line func-names
const gulpTransform = ({ fromWatch, componentList, beforeHook } = {}) => {
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

    if (beforeHook) {
      await beforeHook();
    }

    __cpq.push(dir);

    const { assetId, metadata, error = null } = await processFile({
      dir,
      fromGulp: true,
      fromWatch,
      srcComponentList: componentList,
    });

    __cpq.pop();

    if (global.gc) {
      // Run the garbage collector, if node flag: --expose-gc is present
      global.gc();
    }

    // write precompiled template
    file.basename = 'metadata.min.js';
    file.path = pathLib.join(pathLib.dirname(dir), assetId, file.basename);
    // eslint-disable-next-line no-buffer-constructor
    file.contents = Buffer.from(metadata || '');

    callback(fromWatch ? null : error, file);
  });
};


gulp.task('compile-components', gulp.series(componentList
  .map((name, i) => {
    let beforeHook;

    if (!componentName && i == 0) {
      beforeHook = () => {
        // We are compiling all components, prune the list.json file before the first coponent
        // is compiled, iorder to clear the component cache

        const file = pathLib.join(process.env.PWD, distFolder, 'list.json');
        if (fs.existsSync(file)) {
          fs.rmSync(file);
        }
      }
    }

    const taskName = `compile-component-${name}`;

    gulp.task(taskName, () => gulp.src(pathLib.join(srcFolder, name, 'index.view'))
      .pipe(
        gulpTransform({ componentList, beforeHook })
      )
      .pipe(gulp.dest(pathLib.join(distFolder, name)))
    )
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
      .pipe(gulpTransform({ fromWatch: true }))

      .pipe(gulp.dest(`${distFolder}${componentName ? `/${componentName}` : ''}`))
  });
});
