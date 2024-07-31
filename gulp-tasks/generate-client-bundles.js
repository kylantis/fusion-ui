
const fs = require('fs');
const pathLib = require('path');
const gulp = require('gulp');
const { build } = require('esbuild');

gulp.task('generate-client-bundles', () => {

  const srcFolder = pathLib.resolve(__dirname, 'client-bundles');
  const entryPoints = fs.readdirSync(srcFolder).map(f => pathLib.join(srcFolder, f));

  return build({
    entryPoints,
    bundle: true,
    minify: true,
    treeShaking: true,
    sourcemap: false,
    target: ['es2015'],
    alias: {
      'stream': 'stream-browserify',
    },
    outdir: 'dist/assets/js/client-bundles',
  });
})