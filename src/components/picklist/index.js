class PickList extends BaseComponent {
    tagName() {
        return 'picklist';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/picklist.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/picklist-widget.min.js', '/assets/js/picklist.min.js']);
    }

    getComponentId() {
        return this.#componentId;
    }

    behaviorNames() {
        return ['getSelectedValue'];
    }

    getSelectedValue() {
        this.invokeBehavior('getSelectedValue', null);
    }

    invokeBehavior(behavior, data) {
        const values = $('ul.pickList_targetList').children();
        switch (behavior) {
        case 'getSelectedValue':
            return values.each((i, val) => $(val).text());

        default:
            break;
        }
        return null;
    }

    render() {
        const { node } = this;
        const { data } = this;

        const select = document.createElement('select');
        select.id = this.getComponentId();
        select.name = 'basic';
        select.multiple = true;
        if (data['>']) {
            data['>'].forEach((element) => {
                const optionsTag = document.createElement('option');
                optionsTag.value = element['@dataValue'];
                optionsTag.textContent = element['@title'];
                optionsTag.id = element['@id'];
                select.appendChild(optionsTag);
            });
        }
        $('#submit').click(() => {
            this.getSelectedValue();
        });
        node.append(select);
        $(`#${this.getComponentId()}`).pickList();
    }
}

module.exports = PickList;
