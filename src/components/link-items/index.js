
class LinkItems extends components.LightningComponent {
    beforeCompile() {
        this.getInput().items['@mapKey'].sizes[0];
    }

    initializers() {
        return {
            ['items.$_.sizes']: () => (['size_1-of-5']),
        };
    }

    events() {
        return ['click'];
    }

    sizesTransform(sizes) {
        return sizes.map((size) => `slds-${size}`).join(' ');
    }

    onItemClick(evt) {
        const { currentTarget } = evt;
        const identifier = currentTarget.getAttribute('identifier');
        this.dispatchEvent(identifier);
    }
}
module.exports = LinkItems;