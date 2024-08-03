
const fs = require('fs');
const pathLib = require('path');
const UglifyJS = require('uglify-js');
const gulp = require('gulp');
const through = require('through2');
const utils = require('../lib/utils');


const basePath = 'assets/js';

const srcFolder = `src/${basePath}`;
const destFolder = `dist/${basePath}`;

const globPattern = [`${srcFolder}/**/*.js`, `!${srcFolder}/**/*.min.js`, `!${srcFolder}/data/**`];

const removeInternalSegment = () => {
  return through.obj(async (vinylFile, _encoding, callback) => {
    const file = vinylFile.clone();

    file.path = file.path.replace('/__internal', '');
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

const minifyTransform = () => through.obj((chunk, enc, cb) => {

  const writeFile = (path, contents) => {
    const dir = pathLib.dirname(path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path, contents)
  }

  const toMinifiedName = (n) => n.replace(/\.js$/g, '.min.js');

  const vinylFile = chunk.clone();

  const { contents, base, relative, basename, path } = vinylFile;

  const minifiedRelative = toMinifiedName(relative);
  const minifiedBaseName = toMinifiedName(basename);

  const contentString = contents.toString();

  const { error, code, map } = UglifyJS.minify(
    {
      [basename]: contentString,
    },
    {
      sourceMap: {
        filename: minifiedBaseName,
        url: `/${basePath}/${minifiedRelative}.map`,
      },
      compress: true,
      mangle: true,
    });
  if (error) {
    throw Error(error);
  }

  vinylFile.path = pathLib.join(base, minifiedRelative);
  vinylFile.contents = Buffer.from(
    `${code}\n//# sourceURL=/${basePath}/${minifiedRelative}`
  );

  writeFile(pathLib.join(destFolder, relative), contentString)

  // Write .map file

  const mapFilePath = pathLib.join(destFolder, `${minifiedRelative}.map`);

  writeFile(mapFilePath, map)

  utils.getCompressedFiles(mapFilePath, new TextEncoder().encode(map))
    .forEach(([p, c]) => {
      writeFile(p, c)
    });

  cb(null, vinylFile);
});

const addPipes = (path, relativize) => {
  let stream = gulp.src(path)

  if (relativize) {
    stream = stream.pipe(
      through.obj((chunk, enc, cb) => {
        const vinylFile = chunk.clone();
        vinylFile.base = pathLib.join(process.env.PWD, srcFolder);
        cb(null, vinylFile);
      })
    );
  }

  return stream
    .pipe(removeInternalSegment())
    .pipe(minifyTransform())
    .pipe(compressTransform())
    .pipe(gulp.dest(destFolder));
};

gulp.task('compile-scripts', () => addPipes(globPattern));

gulp.task('compile-scripts:watch', () => {
  const watcher = gulp.watch(
    globPattern,
    { ignoreInitial: true },
  )

  watcher.on('change', (path) => addPipes(path, true));
});
