
const pathLib = require('path');
const gulp = require('gulp');
const through = require('through2');
const rename = require('gulp-rename');
const { build } = require('esbuild');

gulp.task('generate-client-bundles', () => gulp.src([`gulp-tasks/client-bundles/**.js`])
  .pipe(
    through.obj(async (vinylFile, _encoding, callback) => {
      const file = vinylFile.clone();
      const dir = pathLib.dirname(file.path);

      const { outputFiles: [{ contents }] } = await build({
        stdin: {
          contents: new Uint8Array(file.contents),
          resolveDir: dir,
        },
        bundle: true,
        minify: true,
        treeShaking: true,
        sourcemap: false,
        target: ['chrome58', 'firefox57', 'safari11'],
        write: false,
        alias: {
          'stream': 'stream-browserify',
        },
      });

      file.contents = Buffer.from(contents);
      callback(null, file);
    }))
  .pipe(rename({ suffix: '.min' }))
  .pipe(gulp.dest('dist/assets/js/client-bundles')));
