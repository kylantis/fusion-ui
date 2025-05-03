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

const path = require('path');
const fs = require('fs');

const iconsDir = path.join(process.env.PWD, 'src', 'assets', 'icons');

const icons = {};

fs.readdirSync(iconsDir)
    .filter(dirName =>
        !dirName.endsWith('-sprite') &&
        !fs.lstatSync(path.join(iconsDir, dirName)).isFile()
    )
    // .filter(iconType => iconType == 'utility')
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