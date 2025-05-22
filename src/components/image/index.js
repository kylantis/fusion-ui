
class Image extends BaseComponent {
    
    beforeCompile() {
        this.getInput().srcset[0].imageSource;
        this.getInput().srcset[0].sizeDescriptor;

        this.getInput().sizes[0].mediaConditions[0].value
        this.getInput().sizes[0].mediaConditions[0].left;
        this.getInput().sizes[0].mediaConditions[0].operand;
        this.getInput().sizes[0].mediaConditions[0].right;
        this.getInput().sizes[0].imageSize;
    }

    initializers() {
        return {
            ['loading']: 'auto',
            ['sizes_$.mediaConditions_$.operand']: 'and'
        }
    }
}
module.exports = Image;