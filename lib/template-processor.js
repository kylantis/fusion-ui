/* eslint-disable global-require */
module.exports.processFile = ({
  dir, fromGulp, fromWatch, parents = {}, componentList,
  rootAssetId, preprocessors,
}) => {

  // Todo: Add a flag, so that we don't have to compile enums every time
  // if compiling multiple components at once

  const assert = require('assert');
  const fs = require('fs');
  const path = require('path');
  const handlebars = require('handlebars');

  const TemplateReader = require('../lib/template-reader');
  const Preprocessor = require('../lib/template-preprocessor');
  const utils = require('../lib/utils');

  const componentsFolder = path.dirname(dir);
  const logger = console;

  let assetId = path.relative(componentsFolder, dir);

  if (assetId.includes('-')) {
    const index = componentList ? componentList.indexOf(assetId) : -1;
    assetId = assetId.replace(/-/g, '_');

    if (fs.existsSync(path.join(componentsFolder, assetId, 'index.view'), 'utf8')) {
      throw Error(`Duplicate component: "${assetId}"`);
    }

    if (index >= 0) {
      // Update componentList
      componentList[index] = assetId;
    }
  }

  if (!assetId.match(/^[a-zA-Z]+\w+$/g)) {
    throw Error(`Component name: "${assetId}" must be a valid word`);
  }

  if (Preprocessor.getReservedAssetIds().includes(assetId)) {
    throw Error(`Asset Id: "${assetId}" is reserved`);
  }

  const skipFile = Preprocessor.getSkipFile(assetId);

  if (fs.existsSync(skipFile) && fromGulp) {
    fs.rmSync(skipFile);

    const metadataFile = path.join(
      process.env.PWD, 'dist', 'components', assetId, 'metadata.min.js'
    );

    assert(fs.existsSync(metadataFile));

    return Promise.resolve({
      assetId,
      metadata: fs.readFileSync(metadataFile, 'utf8')
    });
  }

  const templateSrc = fs.readFileSync(path.join(dir, 'index.view'), 'utf8');

  TemplateReader.reset();

  global.isServer = true;

  if (fromGulp) {
    logger.info(`\x1b[32m[Processing started for ${dir}]\x1b[0m`);
  }

  const { release } = fromGulp ? Preprocessor.addGlobals() : {};

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
      metadata: {
        fromWatch, componentList,
        rootAssetId: rootAssetId || assetId,
      },
      preprocessors,
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

    metadata = `global['metadata_${assetId}'] = {
      template: ${handlebars.precompile(processor.ast)}
  }`;

    // Write metadata.min.js
    fs.writeFileSync(
      `${processor.getDistPath()}/metadata.min.js`, metadata,
    );

  } catch (e) {
    if (fromGulp) {
      if (fromWatch) {
        logger.error(`\x1b[31m  ${e.stack}\x1b[0m`);
      }
      return Promise.resolve({ assetId, metadata, error: e });
    } else {
      throw e;
    }
  }

  if (!fromGulp) {
    return processor;
  }

  logger.info(`\x1b[32m[Processing complete for ${dir}]\x1b[0m`);

  const loadComponent = async () => {

    // Note that the real reason we are using 'component' (which is based off
    // a class that the default methods - i.e. s$_helpers, s$_dataPaths, e.t.c)
    // is so that there is a hard failure when the developer tries to load a
    // component without using the "components." clause.

    Preprocessor.simulateAppContext();

    // logger.info(JSON.stringify(processor.ast, (key, val) => {
    //   if (val && val.constructor.name === 'Object') {
    //     delete val.parent;
    //   }
    //   return val;
    // }, null));

    // eslint-disable-next-line import/no-dynamic-require
    const samples = require(
      path.join(processor.getDistPath(), 'samples.js'),
    );

    const sample = samples[
      utils.getRandomInt(0, samples.length - 1)
    ];

    const component = new global.components[processor.className]({
      input: sample,
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

    release();
  }

  return processor.preprocessors
    .filter((p) => !fs.existsSync(path.join(p.getDistPath(), 'classes')))
    .reduce(
      (p, x) => p.then(() => x.createModels()),
      Promise.resolve(),
    )
    .then(() => Promise.all([
      processor.createModels(),
      loadComponent()
    ]))
    .then(() => {
      return {
        assetId,
        metadata,
      };
    })
    .catch((e) => {
      if (fromWatch) {
        logger.error(`\x1b[31m${e.stack}\x1b[0m`);
      }
      return { assetId, metadata, error: e };
    });
};
