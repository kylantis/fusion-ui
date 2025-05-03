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

const gulp = require('gulp');

require('require-dir')('gulp-tasks');

gulp.task('build', gulp.series('copy-enums', 'copy-assets', 'copy-component-assets', 'compile-styles', 'compile-component-styles', 'compile-scripts', 'compile-components', 'generate-client-bundles'));

gulp.task('watch', gulp.parallel('copy-enums:watch', 'compile-styles:watch', 'compile-component-styles:watch', 'compile-scripts:watch', 'compile-components:watch'));
