/* eslint-disable global-require */
module.exports.processFile = ({
  dir, fromGulp = false, parents = {}
}) => {

  // Todo: Add a flag, so that we don't have to compile enums every time
  // if compiling multiple components at once

  const fs = require('fs');
  const path = require('path');
  const handlebars = require('handlebars');

  const TemplateReader = require('../lib/template-reader');
  const Preprocessor = require('../lib/template-preprocessor');

  const componentsFolder = path.dirname(dir);
  let assetId = path.relative(componentsFolder, dir);

  if (assetId.includes('-')) {
    assetId = assetId.replace(/-/g, '_');

    if (fs.existsSync(path.join(componentsFolder, assetId, 'index.view'), 'utf8')) {
      throw Error(`Duplicate component: ${assetId}`);
    }
  }

  if (!assetId.match(/^[a-zA-Z]+\w+$/g)) {
    throw Error(`Component name: ${assetId} must be a valid word`);
  }

  if (Preprocessor.getReservedAssetIds().includes(assetId)) {
    throw Error(`Asset Id: ${assetId} is reserved`);
  }

  const templateSrc = fs.readFileSync(path.join(dir, 'index.view'), 'utf8');

  TemplateReader.reset();

  global.isServer = true;

  const logger = console;

  logger.info(`\x1b[32m[Processing started for ${dir}]\x1b[0m`);

  // eslint-disable-next-line new-cap
  let processor;
  let metadata;

  try {
    processor = new Preprocessor({
      srcDir: dir,
      assetId,
      logger,
      templateSrc,
      parents,
    });

    // Process AST
    processor.process();

    const htmlErrors = processor.getHtmlErrors()
      .filter(({ message }) => {

        // If this error is a known error (meaning the error has been detected in a 
        // block for which data binding has already been disabled) there is no need to
        // raise it up again, so filter it out

        const knownW3cErrors = processor.htmlConfig.knownW3cErrors || (processor.htmlConfig.knownW3cErrors = []);
        return !knownW3cErrors.includes(message);
      });

    if (htmlErrors.length) {

      htmlErrors.forEach(({ message }) => logger.warn(message));
      logger.warn(`Disabled data-binding for entire component [${assetId}]`);

    } else {
      processor.addDataBindTransformations();
    }

    processor.finalize();

    metadata = `/* eslint-disable */
  \nglobal['metadata_${assetId}'] = {
      template: ${handlebars.precompile(processor.ast)}
  }`;

    // Write metadata.min.js
    fs.writeFileSync(
      `${processor.getDistPath()}/metadata.min.js`, metadata,
    );

    logger.info(`\x1b[32m[Processing complete for ${dir}]\x1b[0m`);

  } catch (e) {
    if (fromGulp) {
      logger.error(`\x1b[31m${e.stack}\x1b[0m`);
      return Promise.resolve({ assetId, metadata, error: true });
    } else {
      throw e;
    }
  }

  if (!fromGulp) {
    return;
  }

  const createModels = async () => {
    await processor.createModels();

    if (process.env.buildArchive) {
      processor.getModelFactory().buildArchive();
      logger.info(`\x1b[32m[Archive generated successfully]\x1b[0m`);
    }
  }

  const loadComponent = async () => {

    // Note that the real reason we are using 'component' (which is based off
    // a class that the default methods - i.e. s$_helpers, s$_dataPaths, e.t.c)
    // is so that there is a hard failure when the developer tries to load a
    // component without using the "components." clause.

    const { releaseGlobal } = processor
      .getComponent({
        componentSrc: processor.componentSrc,
        instantiate: false,
      });

    processor.addBrowserGlobals();

    Preprocessor.simulateAppContext();

    // logger.info(JSON.stringify(processor.ast, (key, val) => {
    //   if (val && val.constructor.name === 'Object') {
    //     delete val.parent;
    //   }
    //   return val;
    // }, null));

    // eslint-disable-next-line import/no-dynamic-require
    const sampleData = require(
      path.join(processor.getDistPath(), 'sample.js'),
    );

    const component = new global.components[processor.className]({
      input: sampleData,
    });

    let html = await component
      .load({ container: 'container' });

    // Add stylesheet declarations
    html = `
            ${component.cssDependencies().map(url => `<link rel="stylesheet" href="${url}">`).join('\n')}
            ${html}`

    // Write server html
    fs.writeFileSync(
      `${processor.getDistPath()}/server.html`, html,
    );

    delete global.isServer;

    releaseGlobal();
  }

  return Promise.all([
    createModels(),
    loadComponent()
  ])
    .then(() => {
      return {
        assetId,
        metadata,
      };
    })
    .catch((e) => {
      logger.error(`\x1b[31m${e.stack}\x1b[0m`);
      return { assetId, metadata, error: true };
    });
};
