const fs = require('fs');
const pathLib = require('path');

const babel = require('@babel/core');
const gulp = require('gulp');
const watch = require('gulp-watch');

const through = require('through2');

const basePath = 'assets/js';
const distPath = `./dist/${basePath}`;

const transform = through.obj((chunk, enc, cb) => {

  const toMinifiedName = (n) => n.replace(/\.js$/g, '.min.js');

  const jsFile = chunk.clone();

  const { contents, base, relative, basename } = jsFile;

  const minifiedRelative = toMinifiedName(relative);
  const minifiedBaseName = toMinifiedName(basename);

  const contentString = contents.toString();

  const result = babel.transformSync(contentString, {
    sourceFileName: basename,
    sourceMaps: true,
  });

  jsFile.path = pathLib.join(base, minifiedRelative);
  jsFile.contents = Buffer.from(`${result.code}
//# sourceMappingURL=${minifiedBaseName}.map
//# sourceURL=/${basePath}/${minifiedRelative}`);

  // Write non-minified js file
  fs.writeFileSync(
    pathLib.join(distPath, relative),
    contentString,
  )

  // Write .map file  
  delete result.map.sourcesContent;
  result.map.file = minifiedBaseName;
  fs.writeFileSync(
    pathLib.join(distPath, `${minifiedRelative}.map`),
    JSON.stringify(result.map),
  )

  cb(null, jsFile);
});

gulp.task('compile-scripts', () => gulp.src([`src/${basePath}/**/*.js`, `!src/${basePath}/**/*.min.js`])
  .pipe(transform)
  .pipe(gulp.dest(distPath))
);

gulp.task('compile-scripts:watch', () => watch([`src/${basePath}/**/*.js`, `!src/${basePath}/**/*.min.js`], { ignoreInitial: true })
  .pipe(transform)
  .pipe(gulp.dest(distPath))
);
