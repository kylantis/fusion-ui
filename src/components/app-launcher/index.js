
class AppLauncher extends components.Modal {

    beforeRender() {
        const input = this.getInput();

        input.bodyCssClass = 'slds-app-launcher__content';
        input.bodyPadding = 'around_medium';
    }

}
module.exports = AppLauncher;