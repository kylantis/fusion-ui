/**
 * This script helps to automatically refresh the icon names, abd is useful when
 * new icons are added to a new release of lightning design
 */
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const utils = require('../../../lib/utils');

const configFile = path.join(process.env.PWD, 'src', 'components', 'icon', 'config.json');
const iconsDir = path.join(process.env.PWD, 'src', 'assets', 'icons');

const icons = {};

fs.readdirSync(iconsDir)
    .filter(dirName =>
        !dirName.endsWith('-sprite') &&
        !fs.lstatSync(path.join(iconsDir, dirName)).isFile()
    )
    .forEach((iconType) => {

        const iconNames = fs.readdirSync(path.join(iconsDir, iconType))
            .filter(fileName => fileName.endsWith('.svg'))
            .map(iconName => iconName.replace('.svg', ''));

        icons[iconType] = iconNames
    })

const config = JSON.parse(fs.readFileSync(configFile));

config.literals.name.allowed = [];

for (const iconType in icons) {
    assert(config.literals.type.allowed.includes(iconType));
    icons[iconType].forEach(iconName => {
        const arr = config.literals.name.allowed;
        if (!arr.includes(iconName)) {
            arr.push(iconName);
        }
    });
}

const iconTypes = Object.keys(icons);
const anyType = iconTypes[utils.getRandomInt(0, iconTypes.length - 1)];

config.literals.type.defaults = [anyType];

// config.literals.name.defaults = icons[anyType].slice(0, 5);

config.literals.name.defaults = [];
for (let i = 0; i < 5; i++) {
    const index = utils.getRandomInt(0, icons[anyType].length - 1);
    config.literals.name.defaults.push(icons[anyType][index]);
}

fs.writeFileSync(configFile, JSON.stringify(config, null, 2));