const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const utils = require('./utils');

class TemplatePreprocessor {

    constructor(templatePath, content) {

        this.templatePath = templatePath;
        this.content = content;
        this.ast = handlebars.parseWithoutProcessing(this.content);

    }

    /**
     * Process the AST
     */
    process() {

        console.log(`Processing [${path.basename(this.templatePath)}]`);

        // Inline partials
        this.inlinePartials(null, [], this.ast);

        // Create proxies to orchestrate two-way data binding capabilities
        // this.proxyDataBinding();

        //this.helloWorld();

        return handlebars.precompile(this.ast);
    }

    proxyDataBinding() {

        // Validate component sample input
        this.validateComponent();

        const parentNode = [];
        const bindPaths = [];

        let bindMustacheStatement = true;
        let bindMustacheStatementOffset = 0;
        let helper;
        let isEscaped;

        // Determine the bindingType
        // Determine the path
        // Determine structure of mustache declaration + helper
        // Determine structure of #with #for {{../permalink}}
        // Take {{{...}}} into consideration
        // Take {{../permalink}} into conseideration


        // Note: for any given array body, we need to precompile the segment


        var Visitor = handlebars.Visitor;
        const _this = this;

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.Program = function (stmt) {
            Visitor.prototype.Program.call(this, stmt);
        }

        ASTParser.prototype.BlockStatement = function (stmt) {
            
            switch (stmt.path.original) {

                case 'with':

                    if (stmt.params[0].type === 'PathExpression') {

                        bindPaths.push(stmt.params[0].original);
                        parentNode.push(stmt.program.body);

                        const _bindMustacheStatement = bindMustacheStatement;
                        bindMustacheStatement = 0;

                        Visitor.prototype.BlockStatement.call(this, stmt);

                        bindMustacheStatement = _bindMustacheStatement;

                        bindPaths.pop();
                        parentNode.push(stmt.program.body);
                    }

                    break;

                case 'each':

                        bindMustacheStatement++;

                        Visitor.prototype.BlockStatement.call(this, stmt);

                        bindMustacheStatement--;
            }
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {

            if (bindMustacheStatement > 0) {
                Visitor.prototype.MustacheStatement.call(this, stmt);
                return;
            }

            // Validate mustache path
            const fqPath = `${bindPaths.join('.')}.${stmt.path.original}`;

            


            

                const replNodes = [];

                let bindingType;
                // Determine the binding type

                switch (bindingType) {

                    case 'textNode':

                        replNodes = _this.transformMustacheStatements({
                            astNodes: parentNode.length ? parentNode[parentNode.length - 1] : this.ast.body,
                            filter: true,
                            transformer: this.wrapTextNode,
                            params: {
                                rootQualifier: bindPaths.join('.'),
                            }
                        });
                        break;

                    case 'attributeValue':

                        break;

                }

                _this.updateASTNodes();


            Visitor.prototype.MustacheStatement.call(this, stmt);
        }

        const parser = new ASTParser();
        parser.accept(this.ast);


        this.updateASTNodes(astNodes, nodes);

    }

    /**
     * Here, check if the MustacheStatement should be setup for
     * data binding
     * 
     * @param
     * @param {Array<MustacheStatement>} MustacheStatement 
     */
    isMustacheDataPath(path) {

        

        if (!_this.fattenedInput[fqPath]) {
            throw new Error(`Unknown path: ${path} on line ${stmt.path.loc.start.line}`);
        }


        const r = utils.flattenJson(c.getSampleInputData());
        console.log(r);

        return true;
    }


 



    wrapTextNode({ rootQualifier, mustacheStatement }) {

        const fullyQualifiedPath = `${rootQualifier ? (rootQualifier + '.') : ''}${mustacheStatement.path.original}`;

        const id = utils.getRandomInt(10000, 99000);

        const replacementNodes = [];

        replacementNodes.push({ type: 'ContentStatement', original: `<span id='${id}'>`, value: `<span id='${id}'>` });
        replacementNodes.push(mustacheStatement);
        replacementNodes.push({ type: 'ContentStatement', original: `</span>`, value: `</span>` });

        // Add to textNodeBindMap
        const ids = this.textNodeBindMap[`${fullyQualifiedPath}`] || [];
        ids.push(id);
        this.textNodeBindMap[`${fullyQualifiedPath}`] = ids;

        return replacementNodes;
    }

    wrapAttributeValue(rootQualifier, astNodes) {
    }

    wrapArrayBlock(rootQualifier, astNodes) {

    }

    getPartialContents(partialName) {
        const dir = path.dirname(this.templatePath);
        const partialFile = path.join(dir, `${partialName}.hbs`);

        if (!fs.existsSync(partialFile)) {
            throw new Error(`Partial: ${partialName} could not be loaded`);
        }

        return fs.readFileSync(partialFile, 'utf8');
    }

    /**
    * 
    * @param {Statement} astNodes This should are the nodes we want to replace.
    * which is basically an array of objects, indicating the replacement index
    * and replacement nodes.
    */
    updateASTNodes(astNodes, replNodes) {
        // Modify ast array to include template AST nodes
        for (let index = 0; index < replNodes.length; index++) {
            const block = replNodes[index];
            for (const replNode of block.replacementNodes) {
                astNodes.splice(block.replacementIndex, 0, replNode);
                block.replacementIndex++;

                // Increment other replacement indexes by 1
                for (let index2 = index + 1; index2 < replNodes.length; index2++) {
                    const b = replNodes[index2];
                    b.replacementIndex++;
                    b[index2] = b;
                }
            }
        }
    }
}

module.exports = TemplatePreprocessor;