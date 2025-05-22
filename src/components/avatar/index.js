
class Avatar extends components.LightningComponent {

    eventHandlers() {
        return {
            ['insert.size']: ({ value: size, parentObject }) => {
                if (size == 'large' && this.isMobile()) {
                    parentObject.size = 'medium';
                }
            }
        }
    }

    beforeRender() {
        // Note: This can be removed if you don't want it
        this.on('insert.size', 'insert.size');
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