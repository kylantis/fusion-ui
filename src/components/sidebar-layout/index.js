
class SidebarLayout extends components.Drawer {

    initCompile() {

    }

    // this.getContentContainerSelector()

    beforeMount() {
        const input = this.getInput();
        const { navigation } = input;

        if (!navigation) {
            this.throwError('A "vertival navigation" needs to be provided');
        }

        input.showByDefault = true;

        navigation.on('beforeItemRegistered', item => {
            if (item.active) {
                const activeItem = this.getActiveNavigationItem();

                if (activeItem) {
                    activeItem.active = false;
                }
            }
        });
    }

    loadView(identifier) {

        // add caching support


        // use drawer's content container


    }

    setView() {
        
    }

    getActiveNavigationItem() {
        const { navigation } = input;
        return Object.values(navigation.getItems())
            .filter(({ active: c }) => c);
    }

}

module.exports = SidebarLayout;