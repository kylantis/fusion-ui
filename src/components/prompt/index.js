
class Prompt extends components.Modal {

    beforeMount() {
        const input = this.getInput();

        input.tabIndex = 0;
        input.cssClass = 'slds-modal_prompt';

        // Lightning hides the closeIcon in the Prompt component, hence we alaways need to 
        // exclude the markup because it's not needed
        input.closeIcon = false;
    }

}
module.exports = Prompt;