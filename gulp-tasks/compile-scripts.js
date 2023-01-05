const fs = require('fs');
const pathLib = require('path');

const babel = require('@babel/core');
const gulp = require('gulp');

const through = require('through2');



const basePath = 'assets/js';

const srcFolder = `src/${basePath}`;
const distFolder = `dist/${basePath}`;

const watchTarget = [`${srcFolder}/**/*.js`, `!${srcFolder}/**/*.min.js`];


const factory = () => through.obj((chunk, enc, cb) => {

  const writeFile = (path, contents) => {
    const dir = pathLib.dirname(path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path, contents)
  }

  const toMinifiedName = (n) => n.replace(/\.js$/g, '.min.js');

  const vinylFile = chunk.clone();

  const { contents, base, relative, basename } = vinylFile;

  const minifiedRelative = toMinifiedName(relative);
  const minifiedBaseName = toMinifiedName(basename);

  const contentString = contents.toString();

  const result = babel.transformSync(contentString, {
    sourceFileName: basename,
    sourceMaps: true,
  });

  vinylFile.path = pathLib.join(base, minifiedRelative);
  vinylFile.contents = Buffer.from(`${result.code}
//# sourceMappingURL=${minifiedBaseName}.map
//# sourceURL=/${basePath}/${minifiedRelative}`);

  // Write non-minified js file
  writeFile(pathLib.join(distFolder, relative), contentString)

  // Write .map file  
  delete result.map.sourcesContent;
  result.map.file = minifiedBaseName;
  writeFile(
    pathLib.join(distFolder, `${minifiedRelative}.map`),
    JSON.stringify(result.map),
  )

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
    .pipe(factory())
    .pipe(gulp.dest(distFolder));
};

gulp.task('compile-scripts', () => addPipes(watchTarget));

gulp.task('compile-scripts:watch', () => {
  const watcher = gulp.watch(
    watchTarget,
    { ignoreInitial: true },
  )

  watcher.on('change', (path) => addPipes(path, true));
});
