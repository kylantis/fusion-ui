const pathLib = require('path');
const fs = require('fs');
const fsExtra = require("fs-extra");
const shelljs = require('shelljs');
const { pkgName, baseComponentClassName, basePkg } = require('./qt-target-language-java');

// Todo: build eclipse plugin to automatically refresh the jar file after changes
// Todo: Attach src to the jar file

module.exports = () => {
  const buildFolder = pathLib.join(process.env.PWD, 'build');

  if (!fs.existsSync(buildFolder)) {
    throw Error(`Build folder: ${buildFolder} not found`);
  }

  const dist = pathLib.join(process.env.PWD, 'dist');

  const resourcesFolder = pathLib.join(buildFolder, 'resources');
  const classesFolder = pathLib.join(buildFolder, 'classes');

  // Create resources folder
  if (fs.existsSync(resourcesFolder)) {
    fs.rmdirSync(resourcesFolder, { recursive: true });
  }
  fs.mkdirSync(resourcesFolder);

  // Copy assets
  fsExtra.copySync(pathLib.join(dist, 'assets'), pathLib.join(resourcesFolder, 'assets'));


  // Remove BaseComponent files, so that it does not get included
  // in the jar archive
  const baseClassFolder = pathLib.join(
    classesFolder,
    ...basePkg.split('.'),
  );
  fs.unlink(pathLib.join(baseClassFolder, `${baseComponentClassName}.class`), () => { });



  const getClassList = () => new Promise((resolve) => {
    const componentsFolder = pathLib.join(dist, 'components');

    fs.readdirSync(componentsFolder)

      .forEach((assetId) => {

        const src = pathLib.join(componentsFolder, assetId);

        if (fs.lstatSync(src).isFile()) {
          fs.copyFileSync(
            src,
            pathLib.join(resourcesFolder, 'components', assetId)
          );
          return;
        }

        // Copy classes

        const srcClassesFolder = pathLib.join(
          src, 'classes',
          ...pkgName.split('.'), assetId,
        );
        const destClassesFolder = pathLib.join(
          classesFolder,
          ...pkgName.split('.'),
          assetId,
        );

        if (!fs.existsSync(destClassesFolder)) {
          fs.mkdirSync(destClassesFolder, { recursive: true });
        }

        fs.readdirSync(srcClassesFolder).forEach((file2) => {
          if (file2.endsWith('.class')) {
            fs.copyFileSync(pathLib.join(srcClassesFolder, file2), pathLib.join(destClassesFolder, file2));
          }
        });



        // Copy resources

        const destResourcesFolder = pathLib.join(
          resourcesFolder,
          'components',
          assetId,
        );
        fs.mkdirSync(destResourcesFolder, { recursive: true });

        ['index.js', 'index.test.js', 'metadata.min.js', 'sample.js', 'client.html']
          .map(f => pathLib.join(componentsFolder, assetId, f))
          .forEach(src => {
            fs.copyFileSync(src, pathLib.join(destResourcesFolder, pathLib.basename(src)));
          });

      });

    resolve();
  });

  getClassList()
    .then(() => {
      // Build jar

      // We want to place our jar in it's own directory, so that
      // the server has to deal with only the jar while watching
      // the folder
      const jarFolder = pathLib.resolve(buildFolder, 'jar');

      if (fs.existsSync(jarFolder)) {
        fs.rmdirSync(jarFolder, { recursive: true });
      }
      fs.mkdirSync(jarFolder);


      const jarFileName = 'fusion-ui.jar';
      let result;

      result = shelljs.exec([
        'cd', classesFolder, '&&',
        'jar',
        '-cvf0',
        `../jar/${jarFileName}`,
        `.`,
      ].join(' '));
      if (result.code !== 0) {
        throw new Error(result.text);
      }


      result = shelljs.exec([
        'cd', jarFolder, '&&',
        'jar',
        'uf',
        jarFileName,
        `../${pathLib.basename(resourcesFolder)}`,
      ].join(' '));
      if (result.code !== 0) {
        throw new Error(result.text);
      }


      // Clean up folders, after building jar
      fs.rmdirSync(classesFolder, { recursive: true });
      fs.rmdirSync(resourcesFolder, { recursive: true });

    });
};
