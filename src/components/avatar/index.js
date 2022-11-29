
class Avatar extends components.LightningComponent {

    beforeMount() {
        const input = this.getInput();
        const { initials, size } = input;

        // Note: This can be removed if you don't want it
        if (size == 'large' && this.isMobile()) {
            input.size = 'medium';
        }
    }

    verifyInitialsLength(name) {
        if (name.length > 2) {
            this.throwError(`Initial "${name}" should have a maxLength of 2`);
        }
        return name;
    }
    
}
module.exports = Avatar;