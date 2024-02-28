
/* eslint-disable global-require */

module.exports.processFile = ({
  dir, fromGulp, fromWatch, parents = {}, srcComponentList, distComponentList,
  rootAssetId, preprocessors,
}) => {

  const assert = require('assert');
  const fs = require('fs');
  const path = require('path');
  const { spawn } = require('child_process');
  const handlebars = require('handlebars');

  const Preprocessor = require('../lib/template-preprocessor');
  const utils = require('../lib/utils');

  // Todo: Add a flag, so that we don't have to compile enums every time
  // if compiling multiple components at once

  const componentsFolder = path.dirname(dir);
  const logger = console;

  const fileExt = 'view';
  const baseFileName = `index.${fileExt}`;

  const assetId0 = path.relative(componentsFolder, dir);
  let assetId = assetId0;

  if (assetId.includes('-')) {
    const index = srcComponentList ? srcComponentList.indexOf(assetId) : -1;
    assetId = assetId.replace(/-/g, '_');

    if (fs.existsSync(path.join(componentsFolder, assetId, baseFileName), 'utf8')) {
      throw Error(`Duplicate component: "${assetId}"`);
    }

    if (index >= 0) {
      // Update componentList
      srcComponentList[index] = assetId;
    }
  }

  if (!assetId.match(/^[a-zA-Z]+\w+$/g)) {
    throw Error(`Component name: "${assetId}" must be a valid word`);
  }

  if (Preprocessor.getReservedAssetIds().includes(assetId)) {
    throw Error(`Asset Id: "${assetId}" is reserved`);
  }

  let startTime, endTime;

  const notifyStart = () => {
    startTime = performance.now();
    logger.info(`\x1b[32m[Processing started for ${dir}]\x1b[0m`);
  }

  const notifyCompleted = () => {
    endTime = performance.now();
    var timeDiff = endTime - startTime;
    timeDiff /= 1000;
    const timeDiffInSecs = Math.round(timeDiff);
    logger.info(
      `\x1b[32m[Completed${timeDiffInSecs ? ` after ${timeDiffInSecs} seconds` : ''}]\x1b[0m`
    );
  }

  const skipFile = Preprocessor.getSkipFile(assetId);

  if (fs.existsSync(skipFile) && fromGulp) {
    fs.rmSync(skipFile);

    const metadataFile = path.join(
      process.env.PWD, 'dist', 'components', assetId, 'metadata.min.js'
    );

    assert(fs.existsSync(metadataFile));

    notifyStart();
    notifyCompleted();

    return Promise.resolve({
      assetId,
      metadata: fs.readFileSync(metadataFile, 'utf8')
    });
  }

  const templateSrc = fs.readFileSync(path.join(dir, baseFileName), 'utf8');

  if (fromGulp) {
    notifyStart();
  }

  Preprocessor.checkPreconditions();

  Preprocessor.clearRequireCache();

  Preprocessor.logger = logger;

  const { release } = fromGulp ? Preprocessor.addGlobals() : {};

  // eslint-disable-next-line new-cap
  let processor;
  let metadata;

  const compileReferencedComponents = () => {
    return processor.preprocessors
      .filter((p) => !fs.existsSync(path.join(p.getDistPath(), 'classes')))
      .reduce(
        (p, x) => p.then(() => x.createModels()),
        Promise.resolve(),
      )
  }

  try {
    processor = new Preprocessor({
      srcDir: dir,
      assetId,
      logger,
      templateSrc,
      parents,
      metadata: {
        fromWatch,
        srcComponentList,
        distComponentList: distComponentList || Preprocessor.fetchDistComponentList(),
        rootAssetId: rootAssetId || assetId,
        runtimeDecorators: {},
      },
      preprocessors,
    });

    try {
      processor.process();
    } catch (e) {
      release();
      throw e;
    }

    processor.pruneStatements(processor.ast);

    Object.values(processor.metadata.runtimeDecorators)
      .forEach(({ program }) => {
        processor.pruneStatements(program);
      });


    if (processor.dataBindingEnabled()) {

      processor.addDataBindTransformations(processor.ast);

      Object.values(processor.metadata.runtimeDecorators)
        .forEach(({ program }) => {
          processor.addDataBindTransformations(program);
        })

    } else {

      processor.ensureHtmlWrappersAreNotRequired(processor.ast);

      Object.values(processor.metadata.runtimeDecorators)
        .forEach(({ program }) => {
          processor.ensureHtmlWrappersAreNotRequired(program);
        })
    }

    processor.writeStringifiedAst();

    processor.createContentHelperIndirection(processor.ast);

    Object.values(processor.metadata.runtimeDecorators)
      .forEach(({ program }) => {
        processor.createContentHelperIndirection(program);
      })

    processor.finalize();

    processor.updateComponentList();

    // logger.info(JSON.stringify(processor.ast, (key, val) => {
    //   if (val && val.constructor.name === 'Object') {
    //     delete val.parent;
    //   }
    //   return val;
    // }, null));


    // ###################################






    let metadataString = `{
      template: ${handlebars.precompile(processor.ast)},
      decorators: {
        `;


    Object.entries(processor.metadata.runtimeDecorators)
      .forEach(([k, { config, program }], index) => {
        metadataString += `${index > 0 ? ',\n' : ''}['${k}']: {
          config: ${JSON.stringify(config)},
          program: ${handlebars.precompile(program)}
        }`;
      })

    metadataString += `
  }
}`;


    metadata = `global.templates['metadata_${assetId}'] = ${metadataString}`;

    // Write metadata.min.js
    fs.writeFileSync(
      `${processor.getDistPath()}/metadata.min.js`, metadata,
    );

  } catch (e) {
    if (fromGulp) {
      if (fromWatch) {
        logger.error(`\x1b[31m  ${e.stack}\x1b[0m`);
      }
      return (processor ? compileReferencedComponents() : Promise.resolve())
        .then(() => ({ assetId, metadata, error: e }))
    } else {
      throw e;
    }
  }

  if (!fromGulp) {
    return processor;
  }

  const loadComponent = async () => {

    // Note that the real reason we are using 'component' (which is based off
    // a class that the default methods - i.e. s$_helpers, s$_allowedPaths, e.t.c)
    // is so that there is a hard failure when the developer tries to load a
    // component without using the "components." clause.

    processor.loadCompiledComponentClasses();

    self.appContext = Preprocessor.getAppContextObject();

    self.appContext.server = true;

    global.rootComponent = processor.className;

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

    logger.info(`Loading ${processor.className}...`);

    await component.load({ container: '#container' });

    let html = component.getNode0().outerHTML;

    // Add stylesheet declarations
    html = `${component.cssDependencies().map(url => `<link rel="stylesheet" href="${url}">`).join('\n')}\n${html}`

    // Write server html
    fs.writeFileSync(
      `${processor.getDistPath()}/server.html`, html,
    );

    // Clean up globals that were created above
    delete global.rootComponent;
  }

  return compileReferencedComponents()
    .then(async () => {

      const { loadAfterCompile = true } = processor.resolver.config;

      if (loadAfterCompile) {
        try {
          await loadComponent();
        } catch (e) {
          release();
          throw e;
        }
      }

      await processor.createModels();

      // Clean up globals that were created by our preprocessor
      release();
    })
    .then(() => {
      notifyCompleted();

      // Build archive, if applicable
      if (process.env.BUILD_ARCHIVE) {
        // We probably don't want to block gulp
        spawn('npm run --silent build-archive', { stdio: "inherit", shell: true });
      }
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
