
const gulp = require('gulp');
const { build } = require('esbuild');
const { externalGlobalPlugin } = require("esbuild-plugin-external-global");

gulp.task('generate-client-bundle', () => build({
    entryPoints: ['gulp-tasks/client-bundle/index.js'],
    bundle: true,
    minify: true,
    treeShaking: true,
    sourcemap: false,
    target: ['chrome58', 'firefox57', 'safari11'],
    outfile: 'dist/assets/js/client-bundle.min.js',
    alias: {
      'stream': 'stream-browserify',
    },
    plugins: [
      externalGlobalPlugin({
       // Todo: remove plugin if not used
      })
    ],
  }));
