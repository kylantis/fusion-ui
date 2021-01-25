/* eslint-disable global-require */


module.exports.processFile = ({
  dir, fromGulp = false, Preprocessor, parents = {},
}) => {

  const fs = require('fs');
  const path = require('path');
  const handlebars = require('handlebars');
  const log = require('fancy-log');
  const HTMLParser = require('node-html-parser');

  const TemplateReader = require('../lib/template-reader');

  const componentsFolder = path.dirname(dir);
  let assetId = path.relative(componentsFolder, dir);

  if (assetId.includes('-')) {
    assetId = assetId.replace(/-/g, '_');

    if (fs.existsSync(path.join(componentsFolder, assetId, 'index.view'), 'utf8')) {
      throw new Error(`Duplicate component: ${assetId}`);
    }
  }

  if (!assetId.match(/^[a-zA-Z]+\w+$/g)) {
    throw new Error(`Component name: ${assetId} must be a valid word`);
  }

  const templateSrc = fs.readFileSync(`${dir}/index.view`, 'utf8');

  TemplateReader.reset();

  global.isServer = true;

  // eslint-disable-next-line new-cap
  let processor;

  try {
    processor = new Preprocessor({
      srcDir: dir,
      assetId,
      logger: log,
      templateSrc,
      parents,
    });

    processor.process();

  } catch (e) {
    throw e;
    // Todo: Uncomment after initial development
    // log.error(`\x1b[31m${e.message}\x1b[0m`);
    // return Promise.resolve({ assetId });
  }

  const getMetadata = () => {
    return `/* eslint-disable */
        \nglobal['metadata_${assetId}'] = {
            schema: ${JSON.stringify(processor.schema)},
            template: ${handlebars.precompile(processor.ast)}
    }`;
  };

  let metadata = getMetadata();

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

    component
      .load({ container: 'container' })
      .then(() => {

        const html = global.html;

        if (HTMLParser.parse(html)) {

          processor.addDataBindTransformations();
          metadata = getMetadata();
          
        } else {
          log.warn(`Skipping databind transformations, because [${assetId}] does not have fully valid HTML markup`);
        }

        // Write server html
        fs.writeFileSync(
          `${processor.getDistPath()}/server.html`, html,
        );

        // Cleanup global scope
        delete global.isServer;
        releaseGlobal();

        resolve({
          assetId,
          metadata,
        });
      });
  });
};
