class ChainedSelect extends BaseComponent {

    tagName() {
        return 'chainedSelect';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/dropdown.min.css', '/assets/css/input.min.css', '/assets/css/transition.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/chained-select.min.js', '/assets/js/dropdown.min.js', '/assets/js/transition.min.js', '/assets/js/search.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const { data } = this;
        const pselect = document.createElement('select');
        pselect.id = data['@parentId'];
        pselect.name = 'parentId';
        const cselect = document.createElement('select');
        cselect.id = data['@childId'];
        cselect.name = 'childId';
        if (data['>']) {
            const parentData = data['>'];
            parentData.forEach((element) => {
                const optionsTag = document.createElement('option');
                optionsTag.value = element['@class'];
                optionsTag.textContent = element['@name'];
                pselect.appendChild(optionsTag);
                node.append(pselect);
                element['>'].forEach((el) => {
                    const childOpts = document.createElement('option');
                    childOpts.value = el['@value'];
                    $(childOpts).attr('data-available-with', el['@class']);
                    childOpts.textContent = el['@name'];
                    cselect.appendChild(childOpts);
                    node.append(cselect);
                });
            });
        }
        $(`#${data['@childId']}`).chainedTo(`#${data['@parentId']}`);
    }
}

module.exports = ChainedSelect;
