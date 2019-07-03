
class Select extends BaseComponent {
    tagName() {
        return 'select';
    }

    getCssDependencies() {
        if (this.data['@displayStyle'] === 'labeled' || this.data['@displayStyle'] === 'labeled multiple' || this.data['@displayStyle'] === 'labeled dropdown') {
            return super.getCssDependencies().concat(['/assets/css/icon.min.css', '/assets/css/label.min.css', '/assets/css/dropdown.min.css', '/assets/css/input.min.css', '/assets/css/button.min.css', '/assets/css/transition.min.css']);
        }
        if (this.data['@displayStyle'] === 'checkbox') {
            return super.getCssDependencies().concat(['/assets/css/input.min.css', '/assets/css/checkbox.min.css']);
        }
        return super.getCssDependencies().concat(['/assets/css/dropdown.min.css', '/assets/css/input.min.css', '/assets/css/button.min.css', '/assets/css/transition.min.css']);
    }

    getJsDependencies() {
        if (this.data['@displayStyle'] === 'radio' || this.data['@displayStyle'] === 'checkbox'
            || this.data['@displayStyle'] === 'boolean') {
            return super.getJsDependencies().concat(['/assets/js/checkbox.min.js']);
        }
        return super.getJsDependencies().concat(['/assets/js/dropdown.min.js', '/assets/js/transition.min.js']);
    }

    getCheckedValue() {
        $('#submit', () => {
            const val = [];
            $(`input[name=${this.data['@title']}]:checked`).each((i) => {
                val[i] = $(':checked');
            });
            const valueArray = val[0];
            $.each(valueArray, (i, value) => console.log(value.value));
        });
    }

    getValue(...value) {
        return value;
    }

    render() {
        const { node } = this;
        const jsonData = this.data;

        let componentId = `${node.getAttribute('id')}-${this.getRandomInt()}`;

        const uiDiv = document.createElement('div');
        uiDiv.setAttribute('id', componentId);

        if (jsonData['@displayStyle'] === 'select' || jsonData['@displayStyle'] === 'search select') {
            uiDiv.className = 'ui fluid selection';
            if (jsonData['@displayStyle'] === 'search selection') {
                uiDiv.classList.add('search');
            }

            const hiddenInput = document.createElement('input');
            hiddenInput.setAttribute('type', 'hidden');
            hiddenInput.setAttribute('name', jsonData['@title']);
            uiDiv.appendChild(hiddenInput);

            const iTag = document.createElement('i');
            iTag.className = 'dropdown icon';

            const defaultTextDiv = document.createElement('div');
            defaultTextDiv.className = 'default text';
            defaultTextDiv.innerHTML = jsonData['@title'];
            uiDiv.appendChild(iTag);
            uiDiv.appendChild(defaultTextDiv);

            const menuDiv = document.createElement('div');
            menuDiv.className = 'menu';
            uiDiv.append(menuDiv);

            for (const key of Object.keys(jsonData['>'])) {
                if (jsonData['>'][key]['@imageUrl'].length > 0) {
                    const itemDiv = document.createElement('div');
                    const imgTag = document.createElement('img');
                    itemDiv.append(imgTag);
                    imgTag.className = 'ui mini avatar image';
                    imgTag.setAttribute('src', jsonData['>'][key]['@imageUrl']);
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = 'item';
                    itemDiv.setAttribute('data-value', jsonData['>'][key]['@dataValue']);
                    menuDiv.append(itemDiv);
                } else {
                    const itemDiv = document.createElement('div');
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = 'item';
                    itemDiv.setAttribute('data-value', jsonData['>'][key]['@dataValue']);
                    menuDiv.append(itemDiv);
                }
            }

            if (jsonData['@isRequired']) {
                uiDiv.setAttribute('required', '');
            }
            uiDiv.classList.add('dropdown');
            node.append(uiDiv);
        } else if (jsonData['@displayStyle'] === 'labeled' || jsonData['@displayStyle'] === 'labeled multiple' || jsonData['@displayStyle'] === 'labeled dropdown') {
            uiDiv.className = 'ui floating labeled icon dropdown button';
            if (jsonData['@displayStyle'] === 'labeled multiple') {
                uiDiv.classList.remove('floating');
                uiDiv.classList.remove('labeled');
                uiDiv.classList.remove('icon');
                uiDiv.classList.remove('button');
                uiDiv.classList.add('multiple');
            }

            const iTag = document.createElement('i');
            iTag.className = 'filter icon';
            uiDiv.append(iTag);

            const textSpan = document.createElement('span');
            textSpan.className = 'text';
            textSpan.innerHTML = 'Filter Posts'; // to be changed to
            uiDiv.append(textSpan);

            const menuDiv = document.createElement('div');
            menuDiv.className = 'menu';
            uiDiv.append(menuDiv);

            if (jsonData['@displayStyle'] === 'labeled dropdown') {
                for (const key of Object.keys(jsonData['>'])) {
                    const itemDiv = document.createElement('div');
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = 'item';
                    menuDiv.append(itemDiv);
                    node.append(uiDiv);
                }
                return;
            }

            const searchDiv = document.createElement('div');
            searchDiv.className = 'ui icon search input';
            menuDiv.append(searchDiv);

            const iSearchTag = document.createElement('i');
            searchDiv.append(iSearchTag);
            iSearchTag.className = 'search icon';

            const searchInput = document.createElement('input');
            searchInput.setAttribute('type', 'text');
            searchInput.setAttribute('placeholder', 'Search Tags...');
            searchDiv.append(searchInput);

            const dividerDiv = document.createElement('div');
            dividerDiv.className = 'divider';
            menuDiv.append(dividerDiv);

            const headerDiv = document.createElement('div');
            headerDiv.className = 'header';
            menuDiv.append(headerDiv);

            const iTagIcon = document.createElement('i');
            iTagIcon.className = 'tags icon';
            iTagIcon.innerHTML = 'Tag Label';
            headerDiv.append(iTagIcon);

            const scrollingDiv = document.createElement('div');
            scrollingDiv.className = 'scrolling menu';
            menuDiv.append(scrollingDiv);

            for (const key of Object.keys(jsonData['>'])) {
                if (jsonData['>'][key]['@dataValue'].length > 0) {
                    const itemDiv = document.createElement('div');
                    const classDiv = document.createElement('div');
                    classDiv.className = 'ui empty circular label ';
                    classDiv.className += jsonData['>'][key]['@iconName'];
                    itemDiv.appendChild(classDiv);
                    itemDiv.setAttribute('data-value', jsonData['>'][key]['@dataValue']);
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = 'item';
                    scrollingDiv.append(itemDiv);
                } else {
                    const itemDiv = document.createElement('div');
                    const classDiv = document.createElement('div');
                    classDiv.className = 'ui empty circular label ';
                    classDiv.className += jsonData['>'][key]['@iconName'];
                    itemDiv.appendChild(classDiv);
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = 'item';
                    scrollingDiv.append(itemDiv);
                }
            }
        } else if (jsonData['@displayStyle'] === 'multiple select' || jsonData['@displayStyle'] === 'multiple search select') {
            const select = document.createElement('select');
            select.className = 'ui fluid';
            select.setAttribute('multiple', ' ');
            select.setAttribute('name', jsonData['@title']);

            if (jsonData['@displayStyle'] === 'multiple search select') {
                select.classList.add('search');
            }

            const defaultOption = document.createElement('option');
            defaultOption.textContent = jsonData['@defaultTitle'];
            defaultOption.setAttribute('value', '');
            select.appendChild(defaultOption);

            for (const key of Object.keys(jsonData['>'])) {
                if (jsonData['>'][key]['@title'].length > 0) {
                    const option = document.createElement('option');
                    option.setAttribute('value', jsonData['>'][key]['@title']);
                    option.textContent = jsonData['>'][key]['@title'];
                    select.append(option);
                }
            }
            select.classList.add('dropdown');
            uiDiv.appendChild(select);

            componentId += ' > .ui.dropdown';
        } else if (this.data['@displayStyle'] === 'radio' || this.data['@displayStyle'] === 'checkbox') {
            uiDiv.className = 'ui form';
            const alignmentDiv = document.createElement('div');
            alignmentDiv.classList.add(this.data['@alignment']);
            alignmentDiv.classList.add('fields');
            uiDiv.appendChild(alignmentDiv);
            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            alignmentDiv.appendChild(labelDiv);
            const dataValues = this.data['>'];
            if (dataValues.length > 0) {
                dataValues.forEach((data) => {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.className = 'field';
                    const innerUiDiv = document.createElement('div');
                    innerUiDiv.className = 'ui';
                    innerUiDiv.classList.add(this.data['@displayStyle']);
                    innerUiDiv.classList.add('checkbox');
                    fieldDiv.appendChild(innerUiDiv);
                    const innerInputDiv = document.createElement('input');
                    innerInputDiv.type = this.data['@displayStyle'];
                    innerInputDiv.name = this.data['@title'];
                    innerInputDiv.id = `${this.data['@title']}-${data['@id']}`;
                    innerInputDiv.setAttribute('value', data['@dataValue']);
                    innerUiDiv.appendChild(innerInputDiv);
                    const innerLabel = document.createElement('label');
                    innerLabel.textContent = data['@dataValue'];
                    innerUiDiv.appendChild(innerLabel);
                    alignmentDiv.appendChild(fieldDiv);
                    $(innerInputDiv).on(() => {
                        this.getValue(innerInputDiv.value);
                    });
                });
            }
            const button = document.createElement('input');
            button.type = 'submit';
            button.value = 'submit';
            button.id = 'submit';
            uiDiv.append(button);
            $(button).click(() => {
                this.getCheckedValue();
            });
        }

        node.append(uiDiv);
        try {
            $(`#${componentId}`)
                .dropdown();
        // eslint-disable-next-line no-empty
        } catch (error) {}
    }
}
module.exports = Select;
