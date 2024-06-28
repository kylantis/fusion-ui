/**
 * Gulp stylesheets task file
 */
const pathLib = require('path');
const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const through = require('through2');
const gulpif = require('gulp-if');
const streamCombiner = require('stream-combiner2');


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
    .pipe(gulp.dest(distFolder))
};

gulp.task('compile-component-syles', () => addPipes([
  `${srcFolder}/**/*.scss`, `${srcFolder}/**/*.css`,
]));

gulp.task('compile-component-syles:watch', () => {
  const watcher = gulp.watch(
    `${srcFolder}/**/*.{css,scss}`, { ignoreInitial: true }
  );

  watcher.on('change', (path) => addPipes(path, true));
});
