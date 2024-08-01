const pathLib = require('path');
const fs = require('fs');
const assert = require('assert');
const fsExtra = require("fs-extra");
const shelljs = require('shelljs');
const { pkgName } = require('./qt-target-language');
const ModelFactory = require('./factory');

// Todo: Attach src to the jar file

module.exports = () => {

  const logger = console;
  const buildFolder = pathLib.join(process.env.PWD, 'build');

  const dist = pathLib.join(process.env.PWD, 'dist');

  const classesFolder = pathLib.join(buildFolder, 'classes');
  const resourcesFolder = pathLib.join(buildFolder, 'resources');
  const metadataFolder = pathLib.join(buildFolder, 'metadata');
  const sourcesFolder = pathLib.join(buildFolder, 'sources');

  const createFolder = (path) => {
    if (fs.existsSync(path)) {
      fs.rmSync(path, { recursive: true });
    }
    fs.mkdirSync(path, { recursive: true });
  };

  const copyAssets = () => {
    if (fs.existsSync(pathLib.join(dist, 'assets'))) {
      fsExtra.copySync(pathLib.join(dist, 'assets'), pathLib.join(resourcesFolder, 'assets'));
    }
  }

  const copySharedEnumClasses = () => {
    const { getEnumClassesDir, getSharedClassesBaseDir } = ModelFactory;

    const srcEnumsFolder = getEnumClassesDir();

    fs.readdirSync(srcEnumsFolder)
      .forEach((f) => {
        const destEnumsFolder = srcEnumsFolder.replace(getSharedClassesBaseDir(), f.endsWith('.class') ? classesFolder : sourcesFolder);

        if (!fs.existsSync(destEnumsFolder)) {
          fs.mkdirSync(destEnumsFolder, { recursive: true });
        }
        fs.copyFileSync(pathLib.join(srcEnumsFolder, f), pathLib.join(destEnumsFolder, f));
      });
  }

  createFolder(classesFolder);
  createFolder(resourcesFolder);
  createFolder(metadataFolder);
  createFolder(sourcesFolder);

  copyAssets();
  copySharedEnumClasses();


  const doesAllFilesExist = (files) => {
    let b = true;
    for (const file of files) {
      if (!fs.existsSync(file)) {
        b = false;
        break;
      }
    }
    return b;
  }

  const copyComponentFiles = () => {
    const componentsFolder = pathLib.join(dist, 'components');

    fs.readdirSync(componentsFolder)

      .forEach((assetId) => {

        const src = pathLib.join(componentsFolder, assetId);

        if (fs.lstatSync(src).isFile()) {

          // We have a couple of json config files we want to copy to the resources
          // folder as well
          if (src.endsWith('.json') || src.endsWith('.json.br')) {

            const dest = pathLib.join(resourcesFolder, 'components', assetId);

            if (!fs.existsSync(pathLib.dirname(dest))) {
              fs.mkdirSync(pathLib.dirname(dest), { recursive: true });
            }

            fs.copyFileSync(src, dest);
          } else {
            // This may be some un-needed files, ignore
            logger.warn(`Skipping ${src}`);
          }
          return;
        }


        // Ensure that required files are present

        const srcClassesFolder = pathLib.join(
          src, 'classes',
          ...pkgName.split('.'), assetId,
        );

        if (!fs.existsSync(srcClassesFolder)) {
          // Classes not found, skip
          return;
        }

        const requiredResources = [
          'index.min.js', 'index.test.min.js', 'metadata.min.js', 'samples.js', 'schema.json',
          'config.json', 'boot-config.json', 'client.html', '.mainClass'
        ]
          .map(f => pathLib.join(componentsFolder, assetId, f));

        if (!doesAllFilesExist(requiredResources)) {
          console.warn(`[${assetId}] Not all resource files exists, skipping...`);
          return;
        }

        const optionalResources = ['assets', 'style.min.css']
          .map(f => pathLib.join(componentsFolder, assetId, f));

        const resourceFiles = [];

        [...requiredResources, ...optionalResources].forEach(f => {
          resourceFiles.push(f);

          if (f.match(/\.\w$/g)) {
            // If this is a file, add it's compressed couterpart
            resourceFiles.push(`${f}.br`);
          }
        });
        

        // Copy classes

        fs.readdirSync(srcClassesFolder)
          .forEach((f) => {

            const destClassesFolder = pathLib.join(
              f.endsWith('.class') ? classesFolder : sourcesFolder,
              ...pkgName.split('.'),
              assetId,
            );

            if (!fs.existsSync(destClassesFolder)) {
              fs.mkdirSync(destClassesFolder, { recursive: true });
            }

            fs.copyFileSync(pathLib.join(srcClassesFolder, f), pathLib.join(destClassesFolder, f));
          });


        // Copy resources

        const destResourcesFolder = pathLib.join(
          resourcesFolder,
          'components',
          assetId,
        );
        fs.mkdirSync(destResourcesFolder, { recursive: true });

        resourceFiles
          .forEach(src => {
            if (fsExtra.existsSync(src)) {
              fsExtra.copySync(src, pathLib.join(destResourcesFolder, pathLib.basename(src)));
            }
          });
      });
  }

  const buildJar = () => {
    // We need to place our jar in it's own directory, so that the server has to deal with 
    // only the jar while watching the folder for changes
    const jarFolder = pathLib.resolve(buildFolder, 'jar');

    if (fs.existsSync(jarFolder)) {
      fs.rmSync(jarFolder, { recursive: true });
    }
    fs.mkdirSync(jarFolder);

    // Write jar metadata
    const manifestFileName = 'MANIFEST.MF';
    const { APP_ID } = process.env;

    assert(!!APP_ID, 'Please set the env variable: APP_ID');

    const manifestConfig = [
      'Manifest-Version: 1.0',
      'Created-By: 1.7.0_06 (Oracle Corporation)',
      `Application-Name: ${APP_ID}`,
    ];

    fs.writeFileSync(
      pathLib.join(metadataFolder, manifestFileName),
      manifestConfig.join('\n')
    );

    const buildMainJar = () => {
      const jarFileName = 'fusion-ui.jar';
      let result;

      result = shelljs.exec(
        [
          'cd', classesFolder, '&&',
          'jar',
          '--create',
          `--file=../jar/${jarFileName}`,
          `--manifest=../metadata/${manifestFileName}`,
          `.`,
        ].join(' '),
        {
          silent: false
        });
      if (result.code !== 0) {
        throw Error(result.text);
      }

      result = shelljs.exec(
        [
          'cd', jarFolder, '&&',
          'jar',
          'uf',
          jarFileName,
          `../${pathLib.basename(resourcesFolder)}`,
        ].join(' '),
        {
          silent: false
        }
      );
      if (result.code !== 0) {
        throw Error(result.text);
      }
    }

    const buildSourcesJar = () => {
      const jarFileName = 'fusion-ui-sources.jar';
      const result = shelljs.exec(
        [
          'cd', sourcesFolder, '&&',
          'jar',
          '--create',
          `--file=../jar/${jarFileName}`,
          `--manifest=../metadata/${manifestFileName}`,
          `.`,
        ].join(' '),
        {
          silent: false
        });

      if (result.code !== 0) {
        throw Error(result.text);
      }
    }

    buildMainJar();

    buildSourcesJar();

  }

  // Todo: Remove
  const cleanupFiles = () => {
    fs.rmSync(classesFolder, { recursive: true });
    fs.rmSync(resourcesFolder, { recursive: true });
    fs.rmSync(metadataFolder, { recursive: true });
    fs.rmSync(sourcesFolder, { recursive: true });
  }

  copyComponentFiles();

  buildJar();

  // cleanupFiles();

};
