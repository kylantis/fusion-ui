
const path = require('path');
const fs = require('fs');

const iconsDir = path.join(process.cwd(), 'src', 'assets', 'icons');

const icons = {};

fs.readdirSync(iconsDir)
    .filter(dirName =>
        !dirName.endsWith('-sprite') &&
        !fs.lstatSync(path.join(iconsDir, dirName)).isFile()
    )
    // .filter(iconType => iconType == 'action')
    .forEach((iconType) => {

        const iconNames = fs.readdirSync(path.join(iconsDir, iconType))
            .filter(fileName => fileName.endsWith('.svg'))
            .map(iconName => iconName.replace('.svg', ''));

        icons[iconType] = iconNames
    })


let allIconNames = []


for (let names of Object.values(icons)) {
    allIconNames = allIconNames.concat(names);
}

console.info(JSON.stringify([...new Set(allIconNames)]));