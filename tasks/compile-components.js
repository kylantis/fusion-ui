/* eslint-disable no-undef */
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');

const gulp = require('gulp');
const watch = require('gulp-watch');
const through = require('through2');

const { processFile } = require('../lib/template-processor');
const { getAllComponentNames } = require('../lib/utils');


// eslint-disable-next-line func-names
const gulpTransform = ({ fromWatch, componentList, beforeHook } = {}) => {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    const dir = path.dirname(file.path);

    if (fs.existsSync(path.join(dir, '.skip'))) {
      return callback(null, file);
    }

    if (beforeHook) {
      await beforeHook();
    }

    const { assetId, metadata, error = null } = await processFile({
      dir,
      fromGulp: true,
      fromWatch,
      componentList,
    });

    // write precompiled template
    file.basename = 'metadata.min.js';
    file.path = path.join(path.dirname(dir), assetId, file.basename);
    // eslint-disable-next-line no-buffer-constructor
    file.contents = Buffer.from(metadata || '');

    callback(fromWatch ? null : error, file);
  });
};

const componentArgPrefix = '--component=';
const tailArgument = process.argv[process.argv.length - 1];

const componentName = tailArgument.startsWith(componentArgPrefix) ?
  tailArgument.replace(componentArgPrefix, '') : null;

const componentList = componentName ? [componentName] : getAllComponentNames();

gulp.task('compile-components', gulp.series(componentList
  .map((name, i) => {
    let beforeHook;

    if (!componentName && i == 0) {
      beforeHook = () => {
        // We are compiling all components, prune the list.json file before the first coponent
        // is compiled, iorder to clear the component cache

        const file = path.join(process.env.PWD, 'dist', 'components', 'list.json');
        if (fs.existsSync(file)) {
          fs.rmSync(file);
        }
      }
    }

    const taskName = `compile-component-${name}`;

    gulp.task(taskName, () => gulp.src([`src/components/${name}/index.view`])
      .pipe(
        gulpTransform({ componentList, beforeHook })
      )
      .pipe(gulp.dest(`dist/components/${name}`))
    )
    return taskName;
  })));


gulp.task('compile-components:watch', () => watch([
  `src/components/${componentName || '*'}/*.view`,
  `src/components/${componentName || '*'}/*.js`
], { ignoreInitial: true })
  .pipe(gulpTransform({ fromWatch: true }))
  .pipe(gulp.dest(`dist/components${componentName ? `/${componentName}` : ''}`)));
