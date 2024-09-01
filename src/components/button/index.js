
class Button extends components.LightningComponent {

    eventHandlers() {
        return {
            ['insert.stateful']: ({ value: stateful, parentObject }) => {
                const { type } = parentObject;

                if (stateful && (type != 'neutral')) {
                    parentObject.stateful = false;
                }
            },
            ['insert.type']: ({ value: type, parentObject }) => {
                const { stateful } = parentObject;

                if (stateful && (type != 'neutral')) {
                    parentObject.type = 'neutral';
                }
            },
            ['remove.states.$_']: ({ mutationType, parentObject, key, afterMount }) => {
                const { mutationType_DELETE } = BaseComponent.CONSTANTS;
                if (mutationType != mutationType_DELETE) return;

                afterMount(() => {
                    parentObject[key] = this.#geEmptyStateObject();
                });
            },
            ['refreshButtonSize']: () => {
                this.refreshButtonSize();
            }
        }
    }


    beforeRender() {
        this.on('insert.stateful', 'insert.stateful');
        this.on('insert.type', 'insert.type');
        this.on('remove.states.$_', 'remove.states.$_');
    }

    onMount() {
        this.refreshButtonSize();

        this.node.addEventListener("click", () => {
            this.dispatchEvent('click');
        });

        this.node.addEventListener('mouse_leave', () => {
            this.dispatchEvent('mouse_leave');
        });
    }

    afterMount() {
        this.on(
            this.getSizeIntrinsicPaths().map(p => `insert.${p}`).join('|'),
            'refreshButtonSize'
        );
    }

    events() {
        return ['click', 'mouse_leave'];
    }

    initializers() {
        return {
            ['type']: this.getDefaultType(),
            ['states']: () => ({}),
            ['states.$_']: () => this.#geEmptyStateObject(),
        };
    }

    transformers() {
        return {
            ['states']: (states) => {
                if (!states) {
                    states = {};
                }

                this.getStatesNames()
                    .filter(k => !states[k])
                    .forEach(k => {
                        states[k] = this.#geEmptyStateObject();
                    });
            },
        };
    }

    #geEmptyStateObject() {
        return {};
    }

    /**
     * Returns a list of paths that have the ability to affect the button size when
     * their values change
     */
    getSizeIntrinsicPaths() {
        return [
            'states.$_.title', 'states.$_.leftIcon', 'states.$_.rightIcon',
            'title', 'leftIcon', 'rightIcon'
        ]
    }

    /**
     * This method ensure a consistent button width when switching between states
     */
    refreshButtonSize() {

        const { stateful, states = {} } = this.getInput();

        if (!stateful) {
            return;
        }

        const availableStates = states.keys().filter(k => states[k]);

        if (!availableStates.length) {
            return;
        }

        const node = document.createElement('div');
        node.innerHTML = this.node.innerHTML;
        node.style.display = 'contents';
        node.style.visibility = 'hidden';

        document.body.appendChild(node);

        const button = node.querySelector(':scope > button');

        const toNumberFromPxString = (s) => Number(s.replace('px', ''));

        let maxWidth = 0;

        const addWidth = (node) => {
            let width = toNumberFromPxString(getComputedStyle(node).width);
            if (maxWidth < width) {
                maxWidth = width;
            }
        }

        const { borderLeftWidth, borderRightWidth, paddingLeft, paddingRight } = getComputedStyle(button);

        const horizontalLeftSpace = toNumberFromPxString(paddingLeft) + toNumberFromPxString(borderLeftWidth);
        const horizontalRightSpace = toNumberFromPxString(paddingRight) + toNumberFromPxString(borderRightWidth);

        ['not_selected', ...availableStates]
            .map(k => {
                const className = `slds-text-${this.toStateCssClass(k)}`;
                const node = button.querySelector(`span.${className}`);
                node.style.display = 'none';
                return node;
            })
            .forEach(node => {
                node.style.display = 'inline-flex';
                addWidth(node)
                node.style.display = 'none';
            })

        maxWidth += (horizontalLeftSpace + horizontalRightSpace);
        document.body.removeChild(node);
        this.node.querySelector(':scope > button').style.width = `${maxWidth}px`;
    }

    getStatesNames() {
        return ['selected', 'selected_focus'];
    }

    hasAvailableState(state) {
        const { states } = this.getInput();
        return states[state].title != null;
    }

    selectStateTransform(selectStateClass) {
        const classPrefix = 'slds-is-';

        if (selectStateClass.startsWith(classPrefix)) {
            const selectState = selectStateClass.replace(classPrefix, '');

            switch (true) {
                case !this.hasAvailableState('selected'):
                    return 'slds-not-selected';
                case !this.hasAvailableState('selected_focus') && selectState == 'selected':
                    return `${classPrefix}selected-click`;
            }
        }

        return selectStateClass;
    }

    toStateCssClass(state) {
        return state.replace('_', '-');
    }

    getDefaultType() {
        return 'brand';
    }
}
module.exports = Button;