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

const parseMustacheGroups = require('./_parse_mustache_groups');
const inlineVariables = require('./_inline_variables');
const implodeSubExpressions = require('./_implode_subexpressions');
const addLogicGates = require('./_create-logic-gates');
const transformMustacheGroups = require('./_transform_mustache_groups');

module.exports = [
    parseMustacheGroups,
    inlineVariables,
    addLogicGates,
    transformMustacheGroups,
    implodeSubExpressions,
]