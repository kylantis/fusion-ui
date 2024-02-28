
class Avatar extends components.LightningComponent {

    beforeRender() {

        // Note: This can be removed if you don't want it
       
        this.on('insert.size', ({ value: size, parentObject }) => {
            if (size == 'large' && this.isMobile()) {
                parentObject.size = 'medium';
            }
        });
    }

    initializers() {
        return {
            ['initials.name']: '',
        };
    }

    truncateInitials(name) {
        if (name.length > 2) {
            return name.slice(0, 2)
        }
        return name;
    }

}
module.exports = Avatar;