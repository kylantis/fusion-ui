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

class ListBox extends components.LightningComponent {

    static #siemaAnimationDuration = 300;

    #itemIds = [];
    #items = {};

    #siema;
    #mainSiemaChild;

    #highlighted;

    beforeCompile() {
        this.getInput().stateIndex;
        this.getInput().allowMultipleStates;
        this.getInput().selectedItems[0];
    }

    eventHandlers() {
        return {
            ['insert.groups_$.items_$']: ({ value: item, initial }) => {
                if (!item) return;

                this.#items[item.identifier] = item;

                if (!initial) {
                    this.dispatchEvent('itemsUpdate', Object.values(this.#items), [item], []);
                }
            },
            ['insert.groups_$.items_$.selected']: ({ value: selected, initial, parentObject }) => {
                const { selectedItems } = this.getInput();
                const { identifier } = parentObject;

                if (selected) {
                    selectedItems.push(identifier);
                } else if (!initial) {
                    const idx = selectedItems.indexOf(identifier);
                    assert(idx >= 0);

                    selectedItems.splice(idx, 1);
                }
            },
            ['remove.groups_$.items_$']: ({ value: item }) => {
                if (!item) return;

                const { identifier } = item;

                this.#itemIds.splice(
                    this.#itemIds.indexOf(identifier), 1
                );

                delete this.#items[identifier];

                if (!initial) {
                    this.dispatchEvent('itemsUpdate', Object.values(this.#items), [], [item]);
                }
            },
        }
    }

    beforeRender() {
        const input = this.getInput();

        input.selectedItems = [];

        this.on('insert.groups_$.items_$', 'insert.groups_$.items_$');
        this.on('insert.groups_$.items_$.selected', 'insert.groups_$.items_$.selected');
        this.on('remove.groups_$.items_$', 'remove.groups_$.items_$');
    }

    onMount() {
        this.#mainSiemaChild = this.getNode().querySelector('.listbox-siema-child');
    }

    immutablePaths() {
        return [
            'length', 'entity', 'groups_$.items_$.identifier',
        ];
    }

    initializers() {
        return {
            ['entity']: true,
            ['length']: 'seven',
            ['type']: 'vertical',
            ['allowMultipleStates']: true,
            ['groups_$.items_$.identifier']: () => this.randomString()
        };
    }

    transformers() {
        return {
            ['groups_$.items_$.identifier']: (identifier) => {
                if (!identifier || this.#itemIds.includes(identifier)) {
                    identifier = this.randomString();
                }
                this.#itemIds.push(identifier);
                return identifier;
            },
            ['stateIndex']: (value, initial) => initial ? 0 : value,
        };
    }

    events() {
        return ['click', 'itemsUpdate'];
    }

    behaviours() {
        return [
            'setValue', 'pushState', 'popState', 'addHighlight', 'removeHightlight'
        ];
    }

    setValue(groups) {
        this.getInput().groups = groups;
    }

    destroy() {
        super.destroy();

        if (this.#siema) {
            this.#siema.destroy();
            this.#siema = null;
        }

        this.#itemIds = null;
        this.#items = null;
    }

    useWeakRef() {
        return false;
    }

    cloneInlineComponents() {
        return ['groups_$.items_$.icon'];
    }

    getItems() {
        return this.#items;
    }

    onClick(identifier) {

        const { [identifier]: { disabled } } = this.getItems();

        if (!disabled) {
            this.dispatchEvent('click', identifier);
        }
    }

    lengthTransform(value) {
        if (!value) return value;

        const prefix = `slds-dropdown_length-`;

        return `${prefix}${(() => {
            switch (value) {
                case 'five':
                    return '5';
                case 'seven':
                    return '7';
                case 'ten':
                    return '10';
                case 'with-icon-five':
                    return 'with-icon-5';
                case 'with-icon-seven':
                    return 'with-icon-7';
                case 'with-icon-ten':
                    return 'with-icon-10';
            }
        })()}`
    }

    titleTransform(identifier) {
        const { selectedItems } = this.getInput();

        const { title } = this.#items[identifier];
        const idx = selectedItems.indexOf(identifier);

        return title;
    }

    removeWhitespaceTransform(node) {
        const { content: { children: [{ content: { value } }] } } = node;
        value.content = value.content.trim();
    }

    isSolidIcon(icon) {
        return icon.isSolid();
    }

    #getSiemaContainerSelector() {
        return `#${this.getId()}-siema`;
    }

    #getSiema() {
        if (!this.#siema) {
            this.#siema = new Siema({
                selector: this.#getSiemaContainerSelector(),
                draggable: false,
                multipleDrag: false,
                duration: ListBox.#siemaAnimationDuration,
            });
        }
        return this.#siema;
    }

    pushState(state) {
        const input = this.getInput();

        const { stateIndex, allowMultipleStates } = input;

        if (!allowMultipleStates) {
            return;
        }

        if (state.isComponentRendered()) {
            this.throwError(`<state> is already rendered`);
        }

        const parent = this.getInlineParent();

        if (parent instanceof ListBox) {
            return parent.pushState(state);
        }

        const height = ListBox.#getInnerHeightWithoutPadding(this.getNode());

        if (!stateIndex) {
            this.#mainSiemaChild.style.height = `${height}px`;
        }

        input.stateIndex++;

        const siema = this.#getSiema();

        const slide = document.createElement('div');
        slide.classList.add('listbox-siema-child');

        slide.style.height = `${height}px`;
        slide.style.paddingTop = '2em';

        siema.append(slide, async () => {
            state.setInlineParent(this);
            await state.load({ container: slide, wait: false });

            siema.next();
        });
    }

    popState() {
        const input = this.getInput();

        const { stateIndex, allowMultipleStates } = input;

        if (!allowMultipleStates) {
            return;
        }

        const parent = this.getInlineParent();

        if (parent instanceof ListBox) {
            return parent.popState();
        }

        if (!stateIndex) return;

        input.stateIndex--;

        const siema = this.#getSiema();
        const idx = siema.currentSlide;

        siema.prev();

        setTimeout(() => {
            siema.remove(idx);
        }, ListBox.#siemaAnimationDuration);
    }

    #getTitleElements() {
        const { entity } = this.getInput();

        return Object.values(this.getItems()).map(({ identifier, metaText }) => this.#mainSiemaChild.querySelector(
            `#${this.getId()}-${identifier} .slds-media__body ${(entity && metaText) ? '.slds-listbox__option-text_entity > span' : 'span.slds-truncate'}`
        ));
    }

    addHighlight(searchTerm, caseSensitive, displaySearchTerm = true) {
        if (this.#highlighted) {
            this.removeHightlight();
        }
        const input = this.getInput();

        if (displaySearchTerm) {
            input.searchTerm = searchTerm;
        }

        this.#getTitleElements()
            .map(n => n.firstChild)
            .forEach(n => {
                const { innerHTML: title } = n;

                const str = (s) => caseSensitive ? s : s.toLowerCase();

                if (!str(title).includes(str(searchTerm))) return;

                n.innerHTML = '';

                title.split(RegExp(`(${ListBox.#escapeRegex(searchTerm)})`, 'i'))
                    .forEach(s => {
                        let _n;

                        if (str(s) == str(searchTerm)) {
                            _n = document.createElement('mark');
                            _n.innerHTML = s;
                        } else {
                            _n = document.createTextNode(s);
                        }

                        n.appendChild(_n);
                    });
            });

        this.#highlighted = true;
    }

    removeHightlight() {
        if (!this.#highlighted) return;

        const input = this.getInput();

        input.searchTerm = null;

        this.#getTitleElements()
            .map(n => n.firstChild)
            .forEach(n => {
                let buf = '';

                n.childNodes.forEach(_n => {
                    if (_n instanceof Text) {
                        buf += _n.textContent;
                    } else {
                        assert(_n.tagName.toLowerCase() == 'mark');
                        buf += _n.innerHTML;
                    }
                });

                n.innerHTML = buf;
            });

        this.#highlighted = false;
    }

    static #escapeRegex(text) {
        return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }

    static #getInnerHeightWithoutPadding(element) {
        // Get computed styles of the element
        const style = window.getComputedStyle(element);

        // Get clientHeight (includes padding)
        const clientHeight = element.clientHeight;

        // Extract padding values
        const paddingTop = parseFloat(style.paddingTop);
        const paddingBottom = parseFloat(style.paddingBottom);

        // Calculate height without padding
        const heightWithoutPadding = clientHeight - paddingTop - paddingBottom;

        return heightWithoutPadding;
    }

}
module.exports = ListBox;