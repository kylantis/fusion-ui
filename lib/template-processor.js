/* eslint-disable global-require */


module.exports.processFile = ({
  dir, fromGulp = false, Preprocessor, parents = {},
}) => {
  const fs = require('fs');
  const path = require('path');
  const handlebars = require('handlebars');
  const log = require('fancy-log');

  const TemplateReader = require('../lib/template-reader');

  const assetId = path.relative(path.dirname(dir), dir);

  if (!assetId.match(/^[a-zA-Z]+\w+$/g)) {
    throw new Error(`Component name: ${assetId} must be a valid word`);
  }

  const templateSrc = fs.readFileSync(`${dir}/template.hbs`, 'utf8');

  TemplateReader.reset();

  global.isServer = true;

  // eslint-disable-next-line new-cap
  const processor = new Preprocessor({
    assetId,
    logger: log,
    componentName: assetId,
    ast: handlebars.parse(templateSrc),
    parents,
  });

  // Precompile main ast
  const templatePrecompiled = `/* eslint-disable */
      \nglobal['template_${assetId}'] = ${handlebars.precompile(processor.ast)}`;

  // Write template.min.js
  fs.writeFileSync(
    `${processor.getDistPath()}/template.min.js`, templatePrecompiled,
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

    Preprocessor.addComponentGlobals();

    const component = new ComponentClass({
      input: processor.resolver.getSample(),
    });

    component.load({ parent: 'parent' }).then(() => {
      // eslint-disable-next-line no-undef
      const html = document.getElementById('parent').innerHTML;

      // Write server html
      fs.writeFileSync(
        `${processor.getDistPath()}/server.html`, html,
      );

      // Cleanup global scope
      releaseGlobal();

      resolve(templatePrecompiled);
    });
  });
};
