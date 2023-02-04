
class Button extends components.LightningComponent {

    events() {
        return ['click', 'mouse_leave'];
    }

    /**
     * This method ensure a consistent button width when switching between states
     */
    refreshButtonSize() {

        if (this.isHeadlessContext()) {
            return;
        }

        const { stateful, states = {} } = this.getInput();

        if (!stateful) {
            return;
        }

        const availableStates = Object.keys(states)
            .filter(k => states[k])
            .map(k => k.replace(this.getMapKeyPrefix(), ''));

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

    hooks() {
        return {
            ['type']: ({ newValue }) => {
                if (!newValue) {
                    // A type is required for the button to render properly
                    this.getInput().type = this.getDefaultType();
                }
            },
            ['onMount.states.$_']: ({ path, newValue }) => {
                const { getKeyFromIndexSegment, getParentFromPath, getMapKeyPrefix } = this;
                const { selectState } = this.getInput();

                if (!newValue) {
                    // A state has been removed from our states map. If the current "selectState" depends
                    // on the removed state, we need to throw an error - at least to let the developer know
                    // that the component has gone off-track

                    const key = getKeyFromIndexSegment(
                        path.replace(
                            getParentFromPath(path.split('.')),
                            ''
                        )
                    );
                    const state = key.replace(getMapKeyPrefix(), '');
                    const throwErr = () => this.throwError(
                        `Curent selectState "${selectState}" depends on the removed state "${state}"`
                    );

                    switch (state) {
                        case 'selected_focus':
                            if (selectState == 'is-selected') throwErr();
                            break;
                        case 'selected':
                            if (selectState && selectState.startsWith('is-selected')) throwErr();
                            break;
                    }
                }
            },
            ['onMount.states.$_.title']: () => {
                this.refreshButtonSize();
            },
            ['onMount.states.$_.leftIcon']: () => {
                this.refreshButtonSize();
            },
            ['onMount.states.$_.rightIcon']: () => {
                this.refreshButtonSize();
            },
            ['onMount.title']: () => {
                this.refreshButtonSize();
            },
            ['onMount.leftIcon']: () => {
                this.refreshButtonSize();
            },
            ['onMount.rightIcon']: () => {
                this.refreshButtonSize();
            }
        }
    }

    beforeMount() {
        const input = this.getInput();
        const { stateful, type } = input;

        if (stateful) {
            if (type != 'neutral') {
                throw Error(
                    'Stateful buttons are only used with the neutral variation'
                );
            }
        }

        // A type is required for the button to render properly
        if (!type) {
            input.type = this.getDefaultType();
        }
    }

    onMount() {
        this.refreshButtonSize();

        this.node.addEventListener("click", () => {
            this.dispatchEvent('click');
        });

        this.node.addEventListener('mouse_leave', () => {
            this.dispatchEvent('mouse_leave');
        })
    }

    selectStateTransform(selectStateClass) {
        const input = this.getInput();
        const classPrefix = 'slds-is-';

        if (selectStateClass.startsWith(classPrefix)) {
            const availableStates = Object.keys(input.states);
            const selectState = selectStateClass.replace(classPrefix, '');

            switch (true) {
                case !availableStates.includes('selected'):
                    return 'slds-not-selected';
                case !availableStates.includes('selected_focus') && selectState == 'selected':
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