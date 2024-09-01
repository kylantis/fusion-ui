
class SidebarLayout extends components.Drawer {

    // Maintain reference to input data for our "navigation" component
    // to prevent garbage collection
    #navigationInput;

    useWeakRef() {
        return false;
    }
    
    beforeRender() {
        const input = this.getInput();

        const isMobile = this.isMobile();

        input.showByDefault = !isMobile;
        input.overlay = false;
        input.backdrop = false;
        input.size = 'medium';
        input.closeIcon = !!isMobile;
        input.toggleButton = !!isMobile;
    }

    eventHandlers() {
        return {}
    }

    transformers() {
        return {
            ['navigation']: (navigation) => {
                if (!navigation) return;

                navigation
                    .on('afterMount', () => {
                        assert(navigation === this.getInput().navigation);

                        const activeItems = this.getActiveNavigationItems();
                        const firstItem = this.getNavigationItems()[0];

                        if (!activeItems.length && firstItem) {
                            this.setActiveNavItem0(firstItem);
                        }
                    });

                navigation
                    .on('itemRender', new EventHandler(
                        item => {
                            if (item.active) {
                                this.setActiveNavItem0(item);
                            }
                        },
                        this,
                    ));

                this.#navigationInput = navigation.getInput();

                return navigation;
            }
        }
    }

    behaviours() {
        return ['setActiveNavItem'];
    }

    setActiveNavItem(navItemId) {
        const { navigation } = this.getInput();
        const item = navigation.getItems()[navItemId];

        if (item) {
            this.setActiveNavItem0(item);
        }
    }

    setActiveNavItem0(item) {
        const activeItems = this.getActiveNavigationItems();

        activeItems.forEach(item => {
            item.active = false;
        });

        item.active = true;
    }

    loadView(identifier) {

        // add caching support


        // use drawer's content container
    }

    setView() {

    }

    getNavigationItems() {
        const { navigation } = this.getInput();
        return Object.values(navigation.getItems());
    }

    getActiveNavigationItems() {
        return this.getNavigationItems()
            .filter(({ active }) => active);
    }

}

module.exports = SidebarLayout;