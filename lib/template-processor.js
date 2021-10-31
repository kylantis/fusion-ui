/* eslint-disable global-require */


module.exports.processFile = ({
  dir, fromGulp = false, Preprocessor, parents = {}, buildArchive = true
}) => {

  // Todo: Add a flag, so that we don't have to compile enums every time
  // fi compiling multiple components at once

  const {
    isMainThread, parentPort
  } = require('worker_threads');

  const fs = require('fs');
  const path = require('path');
  const handlebars = require('handlebars');

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

  if (Preprocessor.getReservedAssetIds().includes(assetId)) {
    throw new Error(`Asset Id: ${assetId} is reserved`);
  }

  const templateSrc = fs.readFileSync(path.join(dir, 'index.view'), 'utf8');

  TemplateReader.reset();

  global.isServer = true;

  const logger = (() => {
    if (isMainThread) {
      return console;
    }

    // We are in a worker thread, notify the main thread to log message
    const sendLogMessage = ({ logLevel, logMessage }) => {
      parentPort.postMessage({ logLevel, logMessage });
    }

    return {
      // We will be exposing only the basics
      debug: function () { sendLogMessage({ logLevel: 'debug', logMessage: Array.from(arguments) }) },
      error: function () { sendLogMessage({ logLevel: 'debug', logMessage: Array.from(arguments)  }) },
      info: function () { sendLogMessage({ logLevel: 'debug', logMessage: Array.from(arguments)  }) },
      log: function () { sendLogMessage({ logLevel: 'debug', logMessage: Array.from(arguments)  }) },
      warn: function () { sendLogMessage({ logLevel: 'debug', logMessage: Array.from(arguments)  }) },
      trace: function () { sendLogMessage({ logLevel: 'debug', logMessage: Array.from(arguments)  }) },
    }
  })()


  if (fromGulp) {
    logger.info(`\x1b[32m[Processing started for ${dir}]\x1b[0m`);
  }

  // eslint-disable-next-line new-cap
  let processor;

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

  } catch (e) {
    logger.error(`\x1b[31m${e.stack}\x1b[0m`);
    return Promise.resolve({ assetId });
  }

  const metadata = `/* eslint-disable */
  \nglobal['metadata_${assetId}'] = {
      template: ${handlebars.precompile(processor.ast)}
}`;

  // Write metadata.min.js
  fs.writeFileSync(
    `${processor.getDistPath()}/metadata.min.js`, metadata,
  );

  if (fromGulp) {
    logger.info(`\x1b[32m[Processing complete for ${dir}]\x1b[0m`);
  }

  // Now all all component files have been written, build archive
  if (process.env.buildArchive && buildArchive) {

    processor.getModelFactory().buildArchive();
    logger.info(`\x1b[32m[Archive generated successfully]\x1b[0m`);
  }

  if (!fromGulp) {
    return;
  }

  // Note that the real reason we are using 'component' (which is based off
  // a class that the default methods - i.e. s$_helpers, s$_dataPaths, e.t.c)
  // is so that there is a hard failure when the developer tries to load a
  // component without using the "components." clause.

  const { releaseGlobal } = processor
    .getComponent({
      componentSrc: processor.componentSrc,
      instantiate: false,
    });

  // eslint-disable-next-line consistent-return
  return new Promise((resolve) => {

    processor.addBrowserGlobals();

    Preprocessor.simulateAppContext();

    // eslint-disable-next-line import/no-dynamic-require
    const sampleData = require(
      path.join(processor.getDistPath(), 'sample.js'),
    );

    const component = new global.components[processor.className]({
      input: sampleData,
    });

    component
      .load({ container: 'container' })
      .then((html) => {

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
      })
      .catch((e) => {
        logger.error(`\x1b[31m${e.message}\x1b[0m`);
        logger.error(e.stack);

        resolve({ assetId });
      });
  });
};
