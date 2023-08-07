
class SidebarLayout extends components.Drawer {

    initCompile() {

    }

    // this.getContentContainerSelector()

    beforeRender() {
        const input = this.getInput();
        const { navigation } = input;

        if (!navigation) {
            this.throwError('A "vertival navigation" needs to be provided');
        }

        const isMobile = this.isMobile();

        input.showByDefault = !isMobile;
        input.overlay = false;
        input.backdrop = false;
        input.size = 'medium';
        input.closeIcon = !!isMobile;
        input.toggleButton = !!isMobile;


        navigation
            .on('beforeItemRegistered', item => {
                if (item.active) {
                    const activeItem = this.getActiveNavigationItem();

                    if (activeItem) {
                        activeItem.active = false;
                    }
                }
            });
    }

    afterMount() {
        if (!this.getActiveNavigationItem()) {
            this.setActive(
                this.getNavigationItems()[0]
            );
        }
    }

    setActive(item) {
        if (!item) return;

        item.active = true;
    }

    loadView(identifier) {

        // add caching support


        // use drawer's content container


    }

    setView() {

    }

    getSearchBar() {
        return this.getInlineComponent('searchBar');
    }

    getNavigationItems() {
        const { navigation } = this.getInput();
        return Object.values(navigation.getItems());
    }

    getActiveNavigationItem() {
        this.getNavigationItems()
            .filter(({ active: c }) => c);
    }

}

module.exports = SidebarLayout;