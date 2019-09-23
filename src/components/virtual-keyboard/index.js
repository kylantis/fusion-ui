class VirtualKeyboard extends BaseComponent {
    tagName() {
        return 'virtualKeyboard';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/virtual-keyboard.min.css', '/assets/css/custom-vkeyboard.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/virtualkeyboard.min.js']);
    }

    getComponentId() {
        return this.#componentId;
    }

    getBehaviourNames() {
        return [
            'getValue',
        ];
    }

    invokeBehavior(behaviorName, data) {
        switch (behaviorName) {
        case 'getValue':
            return $('#search_field').val();
        default:
            break;
        }
        return null;
    }

    getValue() {
        this.invokeBehavior('getValue', null);
    }

    render() {
        const { node } = this;
        const inputDiv = document.createElement('input');
        inputDiv.type = 'text';
        inputDiv.id = 'search_field';
        const keyboard = document.createElement('div');
        keyboard.id = 'keyboard';
        node.append(inputDiv);
        node.append(keyboard);
        $('#keyboard').jkeyboard({
            layout: 'english',
            input: $('#search_field'),
        });
        $('li .return').click(() => this.getValue());
    }
}

module.exports = VirtualKeyboard;
