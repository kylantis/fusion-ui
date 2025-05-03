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

const importFresh = require('import-fresh');
const assert = require('assert');

class MustacheGroupTransformer {

    static S_EXPR = 'SubExpression';

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform(ast) {
        this.ast = ast;
        this.transformMustacheGroups();
    }

    transformMustacheGroups() {

        const {
            concatenateHelperName, createPathExpression, stringifyHandlebarsNode,
        } = this.preprocessor.constructor;

        const { getVisitor } = MustacheGroupTransformer;

        const Visitor = getVisitor();

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.MustacheGroup = function (stmt) {

            const { items, loc, prune } = stmt;

            this.mutating = true;
            return {
                type: 'SubExpression',
                path: {
                    ...createPathExpression({ original: concatenateHelperName }),
                    loc,
                },
                params: items,
                prune, loc,
                canonicalSource: stringifyHandlebarsNode(stmt, { useSource: true })
            };
        }

        const parser = new ASTParser();
        parser.accept(this.ast);
    }

    static getVisitor() {

        // We want to keep the shared handlebars object clean
        const handlebars = importFresh('handlebars');

        const ASTParser = handlebars.Visitor;

        ASTParser.prototype.ExternalProgram = function (stmt) {
            stmt.type = 'Program';
            this.accept(stmt);
            stmt.type = 'ExternalProgram';
        }

        ASTParser.prototype.MustacheGroup = function (stmt) {
            this.acceptArray(stmt.items);
        }

        ASTParser.prototype.ComponentReference = function () {
        }

        return ASTParser;
    }
}

module.exports = MustacheGroupTransformer;