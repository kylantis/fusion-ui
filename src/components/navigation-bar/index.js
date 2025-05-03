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

class NavigationBar extends components.LightningComponent {

    #itemsBlockData = {};

    eventHandlers() {
        return {
            ['remove.items_$']: ({ value: item }) => {
                if (!item) return;

                const { id } = item;
                delete this.#itemsBlockData[id];
            },
            ['splice.items']: ({ offsetIndexes, newLength }) => {
                Object.values(this.#itemsBlockData)
                    .forEach(blockData => {
                        const entry = blockData['items'];
                        const j = offsetIndexes[entry.index];

                        if (j !== undefined) {
                            entry.index = j;
                        }

                        entry.length = newLength;
                    });
            }
        }
    }

    immutablePaths() {
        return ['items_$.id'];
    }

    onMount() {
        this.on('remove.items_$', 'remove.items_$');
        this.on('splice.items', 'splice.items');
    }

    events() {
        return ['itemClick'];
    }

    behaviours() {
        return ['closeSubMenu'];
    }

    initializers() {
        return {
            ['items_$.id']: () => this.randomString(),
        }
    }

    transformers() {
        return {
            ['items_$.id']: (id) => {
                if (!id || this.#itemsBlockData[id]) {
                    id = this.randomString();
                }
                return id;
            },
        };
    }

    navItemClickListener(evt) {
        const { currentTarget } = evt;

        const itemId = currentTarget.getAttribute('data-id');
        const hasSubMenu = currentTarget.getAttribute('data-has-submenu');

        // If this item has a submenu, this handler will be triggered
        // when item(s) on the submenu are clicked
        if (hasSubMenu && this.#isSubMenuRelatedEvent(evt)) {
            return;
        }

        this.dispatchEvent('itemClick', itemId)
    }

    itemHook({ node, blockData }) {
        const itemId = node.querySelector(':scope > li').getAttribute('data-id');
        this.#itemsBlockData[itemId] = blockData;
    }

    #isSubMenuRelatedEvent(event) {
        const { path } = event;

        for (const elem of path) {
            const { classList } = elem;

            switch (true) {
                case classList.contains(components.Menu.itemClassName()):
                    return true;
                case classList.contains('slds-context-bar__item'):
                    return false;
                default:
                    break;
            }
        }
        return false;
    }

    async closeSubMenu(itemId) {
        const li = this.getNode().querySelector(`li[data-id='${itemId}']`);
        if (!li) return;

        const blockData = this.#itemsBlockData[itemId];
        this.renderDecorator('item_decorator', li.parentNode, blockData);
    }

}
module.exports = NavigationBar;