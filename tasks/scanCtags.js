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

    const BaseComponent = fs.readFileSync(path.join(components, 'base.js'), 'utf8');

    const componentTags = {};

    scripts.forEach((script) => {
      const data = fs.readFileSync(script, 'utf8');
      // eslint-disable-next-line no-unused-vars
      const window = {};
      // eslint-disable-next-line no-unused-vars
      const document = {};

      // eslint-disable-next-line no-eval
      const ComponentClass = eval(`${BaseComponent}${data}`);

      const c = new ComponentClass({
        config: {},
      }, null, false);

      componentTags[c.tagName()] = {
        className: c.constructor.name,
        url: path.relative(components, script).replace('\\', '/').replace('.js', '.min.js'),
      };
    });

    // Create parent directories
    const base = path.join(path.dirname(fs.realpathSync(__filename)), '../dist/components/');
    if (!fs.existsSync(base)) {
      fs.mkdirSync(base, { recursive: true });
    }

    // Write to tags file
    const tagsFile = path.join(base, 'tags.json');

    fs.writeFile(tagsFile, JSON.stringify(componentTags), (err) => {
      if (err) throw err;
      cb();
    });
  });
});
