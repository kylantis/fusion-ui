/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

module.exports.processFile = ({
  dir, fromGulp, fromWatch, parents = {}, srcComponentList, distComponentList,
  rootAssetId, preprocessors,
}) => {

  const assert = require('assert');
  const fs = require('fs');
  const path = require('path');
  const { spawn } = require('child_process');
  const handlebars = require('handlebars');

  const UglifyJS = require('uglify-js');

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
    logger.info(`\x1b[32m[Compile started for ${dir}]\x1b[0m`);
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

  if (fromGulp) {
    Preprocessor.addGlobals();
  }

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

    processor.process();

    processor.pruneStatements(processor.ast);

    Object.values(processor.metadata.runtimeDecorators)
      .forEach(({ program }) => {
        processor.pruneStatements(program);
      });


    if (processor.dataBindingEnabled()) {
      const runtimeDecorators = Object.values(processor.metadata.runtimeDecorators);

      processor.addDataBindTransformations(processor.ast, false, !runtimeDecorators.length);

      runtimeDecorators
        .forEach(({ program, config }, i, arr) => {
          processor.addDataBindTransformations(program, config, i == arr.length - 1);
        });

    } else {

      processor.ensureHtmlWrappersAreNotRequired(processor.ast);

      Object.values(processor.metadata.runtimeDecorators)
        .forEach(({ program }) => {
          processor.ensureHtmlWrappersAreNotRequired(program);
        })
    }

    processor.writeStringifiedViewFileAst();

    processor.createContentHelperIndirection(processor.ast);

    Object.values(processor.metadata.runtimeDecorators)
      .forEach(({ program }) => {
        processor.createContentHelperIndirection(program);
      })

    processor.finalize();

    // logger.info(JSON.stringify(processor.ast, (key, val) => {
    //   if (val && val.constructor.name === 'Object') {
    //     delete val.parent;
    //   }
    //   return val;
    // }, null));


    // ###################################

    const _blockPrograms = {};
    const _programTree = {};

    const precompileAst = (ast, decoratorName) => {

      const templateSpecString = handlebars.precompile(ast);

      const templateSpec = eval(`module.exports = ${templateSpecString}`);

      const pgTerm = `container.program(`;
      const locTerm = `"loc":`;

      const toFqName = (k) => `${decoratorName ? `${decoratorName}/` : ''}${k}`;

      const blockPrograms = {};

      // Generate blockPrograms associations

      Object.entries(templateSpec)
        .forEach(([key, fn]) => {

          const fnString = fn.toString();

          (utils.findWordMatches(fnString, pgTerm) || [])
            .forEach(index => {

              let pgNum = '';

              for (let i = index + pgTerm.length, char; utils.isNumber(char = fnString.charAt(i)); i++) {
                pgNum += char;
              }

              const outerPrg = toFqName(key);
              const innerPrg = toFqName(pgNum);

              const locIndex = utils.findWordMatches(fnString, locTerm, index + pgTerm.length + 1, 1)[0] + locTerm.length;
              const loc = utils.parseJSONFromStringAtIndex(fnString, locIndex);

              const locString = Preprocessor.getLine({ loc }, false, true);

              if (!blockPrograms[locString]) {
                blockPrograms[locString] = { outerPrg, innerPrg };
              } else {
                const pgInfo = blockPrograms[locString];

                pgInfo.innerPrg = [pgInfo.innerPrg];
                pgInfo.innerPrg.push(innerPrg);
              }
            });
        });

      Object.assign(_blockPrograms, blockPrograms);


      const programTree = {};

      // Build program tree

      const addProgram = (key) => {
        if (!programTree[key]) {
          programTree[key] = { key, children: [] };
        }
      }

      Object.values(blockPrograms).forEach(({ outerPrg, innerPrg }) => {
        addProgram(outerPrg);

        (typeof innerPrg == 'string' ? [innerPrg] : innerPrg)
          .forEach(prg => {
            addProgram(prg);

            programTree[outerPrg].children.push(
              programTree[prg],
            );
          })
      });

      const addChildren = (arr, { key, children }) => {
        arr.push(key);
        children.forEach(node => {
          addChildren(arr, node)
        })
      };

      Object.entries(programTree).forEach(([k, v]) => {
        programTree[k] = [];

        v.children.forEach(node => {
          addChildren(programTree[k], node);
        })
      });

      Object.assign(_programTree, programTree);

      return templateSpecString;
    }


    let metadataString = `{
      templateSpec: ${precompileAst(processor.ast)},
      decorators: {
        `;


    Object.entries(processor.metadata.runtimeDecorators)
      .forEach(([k, { config, program }], index) => {
        metadataString += `${index > 0 ? ',\n' : ''}['${k}']: {
          config: ${JSON.stringify(config)},
          templateSpec: ${precompileAst(program, k)},
          locString: '${Preprocessor.getLine(program, false, true)}',
        }`;
      })

    metadataString += `
  },
  blockPrograms: ${JSON.stringify(_blockPrograms)},
  programTree: ${JSON.stringify(_programTree)}
}`;


    metadata = `module.exports = ${metadataString}`;

    const metadataFileName = 'metadata.min.js';

    const { error, code } = UglifyJS.minify(
      {
        [metadataFileName]: metadata,
      },
      {
        compress: true,
        mangle: true
      }
    );
    if (error) {
      throw Error(error);
    }

    metadata = code;

    // Write metadata.min.js
    fs.writeFileSync(
      `${processor.getDistPath()}/${metadataFileName}`, metadata,
    );

  } catch (e) {

    if (processor) {
      processor.pruneAfterFatalError();
    }

    if (fromGulp) {
      if (fromWatch) {
        logger.error(`\x1b[31m  ${e.stack}\x1b[0m`);
      }
      return (processor ? compileReferencedComponents() : Promise.resolve())
        .then(() => {
          return { assetId, metadata, error: e };
        })
    } else {
      throw e;
    }
  }

  if (!fromGulp) {
    return processor;
  }

  const loadComponent = async () => {

    self.appContext = Preprocessor.getAppContextObject();

    processor.loadCompiledComponentClasses();

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

    self.appContext.rootComponent = component;

    logger.info(`Loading ${processor.className}...`);

    await component.load();

    let html = component.getNode0().outerHTML;

    const screenTargetFilter = ({ screenTarget }) => !screenTarget || screenTarget.split('|').includes('desktop');

    // Add html deps
    html = `
      ${component.s$_allCssDependencies()
        .filter(screenTargetFilter)
        .map(({ url }) => `<link rel="stylesheet" href="${url}">`).join('\n')}
      
        ${component.s$_allJsDependencies()
        .filter(screenTargetFilter)
        .map(({ url }) => `<script src="${url}"></script>`).join('\n')}
        
        ${html}
      `

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
          throw e;
        }
      }

      await processor.createModels();
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
