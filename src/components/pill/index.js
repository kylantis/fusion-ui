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

class Pill extends components.LightningComponent {

    #identifiers = [];

    beforeCompile() {
        this.getInput().itemPredicate;
    }

    useWeakRef() {
        return false;
    }

    eventHandlers() {
        return {
            ['remove.items_$']: ({ value: item }) => {
                if (!item) return;

                const { identifier } = item;

                const index = this.#identifiers.indexOf(identifier);
                assert(index >= 0);

                this.#identifiers.splice(index, 1);
            }
        }
    }

    onMount() {
        this.on('remove.items_$', 'remove.items_$');
    }

    immutablePaths() {
        return ['items_$.identifier'];
    }

    cloneInlineComponents() {
        const { itemPredicate } = this.getInput();
        return itemPredicate ? true : [
            'items[0].avatar',
            'items[0].icon',
        ]
    }

    initializers() {
        return {
            ['items_$.identifier']: () => this.randomString(),
            ['alignment']: () => 'horizontal',
        };
    }

    transformers() {
        return {
            ['items_$.identifier']: (identifier) => {
                if (!identifier || this.#identifiers.includes(identifier)) {
                    identifier = this.randomString();
                }
                this.#identifiers.push(identifier);
                return identifier;
            },
        };
    }

    events() {
        return ['itemRemove', 'click'];
    }

    onClick(identifier) {
        this.dispatchEvent('click', identifier);
    }

    getIndexForIdentifier(identifier) {
        const { items } = this.getInput();
        return items.findIndex(({ identifier: id }) => id == identifier);
    }

    onRemoveButtonClick(identifier) {
        const { defaultPrevented } = this.dispatchEvent('itemRemove', identifier);

        if (!defaultPrevented) {
            const { items } = this.getInput();
            const idx = this.getIndexForIdentifier(identifier);

            assert(idx >= 0);
            items.splice(idx, 1);
        }
    }

    itemPredicateFn(item) {
        const { itemPredicate } = this.getInput();

        const inlineParent = this.getInlineParent();

        if (itemPredicate && inlineParent) {
            const predicateFn = inlineParent[itemPredicate];

            if (typeof predicateFn == "function") {
                return predicateFn.bind(inlineParent)(item);
            }
        }
        return true;
    }

    refreshItem(identifier) {
        const idx = this.getIndexForIdentifier(identifier);

        if (idx >= 0) {
            this.checkPredicate(`items[${idx}]`)
        }
    }

}
module.exports = Pill;