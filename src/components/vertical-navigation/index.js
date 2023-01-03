
class VerticalNavigation extends components.LightningComponent {

    initCompile() {
        this.getInput().truncateSize;
    }

    beforeMount() {
        // const { section } = this.getInput();

    }

    events() {
        return ['click'];
    }

    getItems() {
        return this.items || (this.items = {});
    }

    getActiveItem() {
        return Object.values(this.getItems()).filter(({ active: c }) => c);
    }

    itemHook({ node, blockData, initial }) {
        const { pathSeparator } = RootProxy;

        const { index: sectionIndex } = blockData['sections'];
        const { index: itemIndex } = blockData[`sections_$${pathSeparator}items`];

        const { sections } = this.getInput();

        const section = sections[sectionIndex];

        if (!section.id) {
            section.id = clientUtils.randomString();
        }

        const item = section.items[itemIndex];

        if (!item.id) {
            item.id = clientUtils.randomString();
        }

        this.registerItem(item);
    }

    registerItem(item) {

        if (item.active) {
            const activeItem = this.getActiveItem();

            if (activeItem) {
                activeItem.active = false;
            }
        }

        this.getItems()[item.id] = item;
    }

    onClick(evt) {

        // 

        this.dispatchEvent(
            'click',
            evt.target.getAttribute("identifier")
        );
    }
}
module.exports = VerticalNavigation;