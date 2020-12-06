/* eslint-disable global-require */


module.exports.processFile = ({
  dir, fromGulp = false, Preprocessor, parents = {},
}) => {
  const fs = require('fs');
  const path = require('path');
  const handlebars = require('handlebars');
  const log = require('fancy-log');

  const TemplateReader = require('../lib/template-reader');

  const componentsFolder = path.dirname(dir);
  let assetId = path.relative(componentsFolder, dir);

  if (assetId.includes('-')) {
    assetId = assetId.replace(/-/g, '_');

    if (fs.existsSync(path.join(componentsFolder, assetId, 'template.hbs'), 'utf8')) {
      throw new Error(`Duplicate component: ${assetId}`);
    }
  }

  if (!assetId.match(/^[a-zA-Z]+\w+$/g)) {
    throw new Error(`Component name: ${assetId} must be a valid word`);
  }

  const templateSrc = fs.readFileSync(`${dir}/template.hbs`, 'utf8');

  TemplateReader.reset();

  global.isServer = true;

  // eslint-disable-next-line new-cap
  const processor = new Preprocessor({
    srcDir: dir,
    assetId,
    logger: log,
    ast: handlebars.parse(templateSrc),
    parents,
  });

  const metadata = `/* eslint-disable */
      \nglobal['metadata_${assetId}'] = {
        schema: ${JSON.stringify(processor.schema)},
        template: ${handlebars.precompile(processor.ast)}
      }`;

  // Write metadata.min.js
  fs.writeFileSync(
    `${processor.getDistPath()}/metadata.min.js`, metadata,
  );

  if (!fromGulp) {
    return;
  }

  // Note that the real reason we are using 'component' (which is based off
  // a class that the default methods - i.e. s$_helpers, s$_dataPaths, e.t.c)
  // is so that there is a hard failure when the developer tries to load a
  // component without using the "components." clause.

  const { ComponentClass, releaseGlobal } = processor
    .getComponent({
      componentSrc: processor.componentSrc,
      instantiate: false,
    });

  // eslint-disable-next-line consistent-return
  return new Promise((resolve) => {
    delete global.isServer;

    Preprocessor.addGlobals();

    Preprocessor.addComponentGlobals();

    // eslint-disable-next-line import/no-dynamic-require
    const sampleData = require(
      path.join(processor.getDistPath(), 'sample.js'),
    );

    // ComponentClass
    const component = new global.components[processor.className]({
      input: sampleData,
    });

    Promise.resolve().then(() => {
      // eslint-disable-next-line no-undef
      const html = document.getElementById('parent').innerHTML;

      // Write server html
      fs.writeFileSync(
        `${processor.getDistPath()}/server.html`, html,
      );

      // Cleanup global scope
      releaseGlobal();

      resolve({
        assetId,
        metadata,
      });
    });
  });
};
