
const fs = require('fs');
const pathLib = require('path');
const gulp = require('gulp');
const { build } = require('esbuild');
const utils = require('../lib/utils');

gulp.task('generate-client-bundles', async () => {

  const srcFolder = pathLib.resolve(__dirname, 'client-bundles');
  const entryPoints = fs.readdirSync(srcFolder).map(f => pathLib.join(srcFolder, f));

  const { outputFiles } = await build({
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
    write: false,
  });

  outputFiles.forEach(({ path, contents }, i) => {
    if (i == 0) {
      const dir = pathLib.dirname(path);
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(path, contents);

    utils.getCompressedFiles(path, contents)
      .forEach(([p, c]) => {
        fs.writeFileSync(p, c)
      });
  });

});