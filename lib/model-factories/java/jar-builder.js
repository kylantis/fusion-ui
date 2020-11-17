const pathLib = require('path');
const fs = require('fs');
const shelljs = require('shelljs');
const { pkgName, baseComponentClassName, baseComponentPkg } = require('./qt-target-language-java');

// Todo: build eclipse plugin to automatically refresh the jar file after changes
// Todo: Attach src to the jar file
module.exports = () => {
  const buildFolder = pathLib.join(process.env.PWD, 'build');
  if (!fs.existsSync(buildFolder)) {
    fs.mkdirSync(buildFolder, { recursive: true });
  }

  const dist = pathLib.join(process.env.PWD, 'dist');

  const baseClassFolder = pathLib.join(
    buildFolder,
    ...baseComponentPkg.split('.'),
  );
  fs.unlink(pathLib.join(baseClassFolder, `${baseComponentClassName}.class`), () => {});
  fs.unlink(pathLib.join(baseClassFolder, `${baseComponentClassName}.java`), () => {});

  const getClassList = () => new Promise((resolve) => {
    const componentsFolder = pathLib.join(dist, 'components');

    fs.readdirSync(componentsFolder)

      .forEach((assetId) => {
        if (fs.lstatSync(pathLib.join(componentsFolder, assetId)).isFile()
        ) {
          return;
        }

        const srcFolder = pathLib.join(
          componentsFolder, assetId, 'classes',
          ...pkgName.split('.'), assetId,
        );
        const destFolder = pathLib.join(
          buildFolder,
          ...pkgName.split('.'),
          assetId,
        );

        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true });
        }

        const classes = fs.readdirSync(srcFolder);

        classes.forEach((file2) => {
          fs.copyFileSync(pathLib.join(srcFolder, file2), pathLib.join(destFolder, file2));
        });
      });

    resolve();
  });

  getClassList()
    .then(() => {
    // Build jar
      const jarCommand = [
        'cd', buildFolder, '&&',
        'jar',
        '-cvf0',
        'all-components.jar',
        '.',
      ].join(' ');

      const result = shelljs.exec(jarCommand);
      if (result.code !== 0) {
        throw new Error(result.text);
      }

      fs.rmdirSync(
        pathLib.join(buildFolder, pkgName.split('.')[0]),
        { recursive: true },
      );
    });
};
