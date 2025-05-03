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

class SubExpressionTransformer {

    static S_EXPR = 'SubExpression';

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform(ast) {
        this.ast = ast;
        this.implodeSubExpressions();
    }

    implodeSubExpressions() {

        const { getLine } = this.preprocessor.constructor;

        const { S_EXPR, getVisitor } = SubExpressionTransformer;

        const Visitor = getVisitor();

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.SubExpression = function (stmt) {

            const ensureNoHashesOrParams = (stmt) => {
                assert(
                    !stmt.params.length,
                    `No params allows in ${S_EXPR}: ${getLine(stmt)}`
                );

                assert(
                    !stmt.hash || !stmt.hash.pairs.length,
                    `No hashes allows in ${S_EXPR}: ${getLine(stmt)}`
                );
            }

            const unwrap = (stmt) => {
                if (stmt.type != S_EXPR) {
                    return stmt;
                }
                if (['Literal'].includes(stmt.path.type)) {
                    ensureNoHashesOrParams(stmt);
                    return stmt.path;
                }

                stmt.params = stmt.params.map(unwrap);

                if (stmt.hash) {
                    stmt.hash.pairs = stmt.hash.pairs.map(pair => {
                        pair.value = unwrap(pair.value);
                        return pair;
                    });
                }
                return stmt;
            };

            const visitSubExpression = (stmt) => {

                if (stmt.type != S_EXPR) {
                    return stmt;
                }

                stmt.params = stmt.params.map(visitSubExpression);

                if (stmt.hash) {
                    stmt.hash.pairs = stmt.hash.pairs.map(pair => {
                        pair.value = visitSubExpression(pair.value);
                        return pair;
                    });
                }

                if (stmt.path.type != S_EXPR || stmt.params.length || stmt.hash) {
                    return stmt;
                } else {
                    return visitSubExpression(stmt.path);
                }
            }

            this.mutating = true;
            return unwrap(visitSubExpression(stmt));
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {
            stmt.type = S_EXPR;
            return {
                ...ASTParser.prototype.SubExpression.call(this, stmt),
                type: 'MustacheStatement',
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

        ASTParser.prototype.ComponentReference = function () {
        }
        
        return ASTParser;
    }
}

module.exports = SubExpressionTransformer;