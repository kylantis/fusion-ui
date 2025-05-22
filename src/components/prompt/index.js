
class Prompt extends components.Modal {

    beforeRender() {
        const input = this.getInput();

        input.tabIndex = 0;
        input.cssClass = 'slds-modal_prompt';

        // Lightning hides the closeIcon in the Prompt component, hence we alaways need to 
        // exclude the markup because it's not needed
        input.closeIcon = false;
    }

    initializers() {
        return {
            ['type']: 'shade'
        }
    }

}
module.exports = Prompt;