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

const pathLib = require('path');
const fs = require('fs');
const assert = require('assert');
const fsExtra = require("fs-extra");
const shelljs = require('shelljs');
const { pkgName } = require('./qt-target-language');
const ModelFactory = require('./factory');
const utils = require('../../../lib/utils');

// Todo: Attach src to the jar file

module.exports = () => {

  const logger = console;
  const buildFolder = pathLib.join(process.env.PWD, 'build');

  const dist = pathLib.join(process.env.PWD, 'dist');

  const classesFolder = pathLib.join(buildFolder, 'classes');
  const resourcesFolder = pathLib.join(buildFolder, 'resources');
  const metadataFolder = pathLib.join(buildFolder, 'metadata');
  const sourcesFolder = pathLib.join(buildFolder, 'sources');
  const jarFolder = pathLib.join(buildFolder, 'jar');

  const javadocFolderName = 'javadoc';

  const createFolder = (path) => {
    if (fs.existsSync(path)) {
      fs.rmSync(path, { recursive: true });
    }
    fs.mkdirSync(path, { recursive: true });
  };

  const copyAssets = () => {
    if (fs.existsSync(pathLib.join(dist, 'assets'))) {
      fsExtra.copySync(
        pathLib.join(dist, 'assets'),
        pathLib.join(resourcesFolder, 'assets'),
        // {
        //   // Exclude .map files
        //   filter: (src) => !src.includes('.map')
        // }
      );
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
  createFolder(jarFolder);

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
          if (src.includes('.json')) {

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
          'index.js', 'index.min.js', 'index.min.js.map', 'index.test.min.js', 'index.test.min.js.map', 'metadata.min.js', 'samples.js', 'schema.json',
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

          if (f.match(/\.\w+$/g)) {

            // If this is a file, include it's compressed couterparts
            utils.getCompressionAlgorithms().forEach(algo => {
              resourceFiles.push(`${f}.${algo}`);
            });
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

    const manifestConfig = [
      'Manifest-Version: 1.0',
      'Created-By: 1.7.0_06 (Oracle Corporation)',
      `Application-Name: Kylantis UI Bundle`,
    ];

    fs.writeFileSync(
      pathLib.join(metadataFolder, manifestFileName),
      manifestConfig.join('\n')
    );

    const generateJavadocs = () => {
      const { getSharedClassesBaseDir } = ModelFactory;

      const result = shelljs.exec(
        [
          'cd', jarFolder, '&&',
          'javadoc',
          '-Xdoclint:all,-missing',
          '-d', javadocFolderName,
          '-sourcepath', sourcesFolder,
          '-cp',
          getSharedClassesBaseDir(),
          '-subpackages',
          pkgName,
        ].join(' '),
        {
          silent: false
        });

      if (result.code !== 0) {
        throw Error(result.text);
      }
    }

    const buildMainJar = () => {
      const jarFileName = 'fusion-ui.jar';
      let result;

      // create jar file

      result = shelljs.exec(
        [
          'cd', jarFolder, '&&',
          'jar', 'cfm', jarFileName,
          pathLib.join(metadataFolder, manifestFileName),
          '-C', classesFolder, '.',
        ].join(' '),
        {
          silent: false
        });
      if (result.code !== 0) {
        throw Error(result.text);
      }

      // add resources to jar

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

    const buildJavadocJar = () => {
      generateJavadocs();

      const jarFileName = 'fusion-ui-javadoc.jar';
      const result = shelljs.exec(
        [
          'cd', pathLib.join(jarFolder, javadocFolderName), '&&',
          'jar',
          '--create',
          `--file=../${jarFileName}`,
          `--manifest=../../metadata/${manifestFileName}`,
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

    buildJavadocJar();
  }

  copyComponentFiles();

  buildJar();
};
