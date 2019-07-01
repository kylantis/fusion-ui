
const gulp = require('gulp');
const fs = require('fs');
const path = require('path');

gulp.task('scanCtags', (cb) => {
  const components = path.join(path.dirname(fs.realpathSync(__filename)), '../src/components');

  fs.readdir(components, (_err, files) => {
    const scripts = [];

    files.forEach((file) => {
      const dir = path.join(components, file);
      if (fs.lstatSync(dir).isDirectory()) {
        scripts.push(path.join(dir, 'index.js'));
      }
    });

    // console.log(scripts);

    // Load base.js
    // eslint-disable-next-line global-require
    // eslint-disable-next-line import/no-dynamic-require
    const BaseComponent = fs.readFileSync(path.join(components, 'base.js'), 'utf8');

    scripts.forEach((script) => {
      const data = fs.readFileSync(script, 'utf8');
      // eslint-disable-next-line no-eval
      const ComponentClass = eval(BaseComponent + data);
      const window = {};
      console.log(new ComponentClass({
        config: {},
      }, null, false).tagName());
    });

    cb();
  });
});
