/**
 * Gulp stylesheets task file
 * compiles all script files, then minify into dist folder
 * @author Tony
 */
const fs = require('fs');
const babel = require('@babel/core');
const gulp = require('gulp');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const watch = require('gulp-watch');

const through = require('through2');

const renameConfig = {
  suffix: '.min',
};

const babelTransform = through.obj((vinylFile, encoding, callback) => {
  const file = vinylFile.clone();
  const filePath = `${file.base}/${file.relative}`;
  const result = babel.transformSync(fs.readFileSync(filePath, 'utf8'));
  file.contents = Buffer.from(result.code);
  callback(null, file);
});

gulp.task('compile-scripts', () => gulp.src(['src/assets/js/**/*.js', '!src/assets/js/**/*.min.js'])
  .pipe(babelTransform)
  .pipe(sourcemaps.init())
  .pipe(uglify({
    mangle: false,
    compress: true,
  }).on('error', (msg) => {
    console.error(msg);
  }))
  .pipe(sourcemaps.write())
  .pipe(rename(renameConfig))
  .pipe(gulp.dest('./dist/assets/js')));


gulp.task('compile-scripts:watch', () => watch(['src/assets/js/**/*.js', '!src/assets/js/**/*.min.js'], { ignoreInitial: true })
  .pipe(babelTransform)
  .pipe(sourcemaps.init())
  .pipe(uglify({
    mangle: false,
    compress: true,
  }).on('error', (msg) => {
    console.error(msg);
  }))
  .pipe(sourcemaps.write())
  .pipe(rename(renameConfig))
  .pipe(gulp.dest('./dist/assets/js')));
