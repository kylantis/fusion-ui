/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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