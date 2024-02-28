

const gulp = require('gulp');

const srcFile = 'src/components/enums.json';
const destFolder = 'dist/components';

const fn = () => gulp.src([srcFile])
.pipe(gulp.dest(destFolder));

gulp.task('copy-enums', fn);

gulp.task('copy-enums:watch', () => {
  const watcher = gulp.watch(
    [srcFile],
    { ignoreInitial: true },
  )

  watcher.on('change', fn);
});
