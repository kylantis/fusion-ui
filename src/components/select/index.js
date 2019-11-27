
class Select extends BaseComponent {
    tagName() {
        return 'select';
    }

    componentId = this.getId();

    behaviorNames() {
        return ['getSelectedValue', 'getCheckedValue'];
    }

    getCssDependencies() {
        if (this.getDisplayStyle() === 'labeled' || this.getDisplayStyle() === 'labeled multiple'
            || this.getDisplayStyle() === 'labeled dropdown' || this.getDisplayStyle() === 'multiple search select'
            || this.getDisplayStyle() === 'multiple select') {
            return super.getCssDependencies().concat(['/assets/css/transition.min.css', '/assets/css/dropdown.min.css',
                '/assets/css/icon.min.css', '/assets/css/label.min.css', '/assets/css/input.min.css',
                '/assets/css/button.min.css']);
        }
        if (this.getDisplayStyle() === 'checkbox') {
            return super.getCssDependencies().concat(['/assets/css/input.min.css', '/assets/css/checkbox.min.css']);
        }
        return super.getCssDependencies().concat(['/assets/css/dropdown.min.css', '/assets/css/input.min.css', '/assets/css/button.min.css', '/assets/css/transition.min.css']);
    }

    getJsDependencies() {
        if (this.getDisplayStyle() === 'radio' || this.getDisplayStyle() === 'checkbox'
            || this.getDisplayStyle() === 'boolean') {
            return super.getJsDependencies().concat(['/assets/js/checkbox.min.js']);
        }
        return super.getJsDependencies().concat(['/assets/js/dropdown.min.js', '/assets/js/transition.min.js', '/assets/js/search.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    getCheckedValue() {
        return this.invokeBehavior('getCheckedValue', null);
    }

    getSelectedValue() {
        return this.invokeBehavior('getSelectedValue', null);
    }

    invokeBehavior(behavior, data) {
        if (behavior === 'getSelectedValue') {
            switch (this.getDisplayStyle()) {
            case 'multiple select':
                return (() => {
                    const select = this.node.querySelector('select');
                    // eslint-disable-next-line
                    const id = select.id;
                    let val = [];
                    val = $(`${id} .active, .filtered`);
                    const values = [];
                    $.each(val, (i, value) => values.push($(value).text()));
                    this.triggerEvent('getValue', values, this.data);
                    return values;
                })();
            case 'select': case 'labeled':
                return (() => {
                    const id = this.node.firstElementChild.getAttribute('id');
                    const val = [];
                    $(`${id}.dropdown, .active, .selected:selected`).each((i) => {
                        val[i] = $('.active, .selected:selected').text();
                    });
                    this.triggerEvent('getValue', val, this.data);
                    return val;
                })();
            case 'labeled multiple':
                return (() => {
                    const id = this.node.firstElementChild.getAttribute('id');
                    let val = [];
                    val = $(`${id}, a.visible`);
                    const values = [];
                    $.each(val, (i, value) => values.push($(value).text()));
                    this.triggerEvent('getValue', values, this.data);
                    return values;
                })();
            case 'labeled dropdown':
                return (() => {
                    const id = this.node.firstElementChild.getAttribute('id');
                    const val = [];
                    $(`${id}, span.text`).each((i) => {
                        val[i] = $('span').text();
                    });
                    this.triggerEvent('getValue', val, this.data);
                    return val;
                })();
            default:
                return null;
            }
        }
        if (behavior === 'getCheckedValue') {
            // eslint-disable-next-line consistent-return
            return (() => {
                let val = [];
                $(`input[name=${this.data['@title']}]:checked`).each((i) => {
                    val[i] = $(':checked');
                    console.log($(val).next().html());
                });
                if (val.length > 0) {
                    const valueArray = val[0];
                    val = [];
                    $.each(valueArray, (i, value) => val.push(value.id));
                    const values = val.map((value) => {
                        const x = $(`#${value}`);
                        return $(x).next().html();
                    });
                    this.triggerEvent('getValue', values, this.data);
                    return values;
                }
            })();
        }
        return null;
    }

    getDisplayStyle() {
        if (this.data['@selectionType'] === 'single' && this.data['@viewType'] === 'check') {
            return 'radio';
        }
        if (this.data['@selectionType'] === 'single' && this.data['@viewType'] === 'dropdown') {
            if (this.data['@viewSubType'] === 'labeled') {
                return 'labeled dropdown';
            }
            return 'select';
        }
        if (this.data['@selectionType'] === 'multiple' && this.data['@viewType'] === 'check') {
            return 'checkbox';
        }
        if (this.data['@selectionType'] === 'multiple' && this.data['@viewType'] === 'dropdown') {
            if (this.data['@viewSubType'] === 'labeled') {
                return 'labeled multiple';
            }
            return 'multiple select';
        }
        return 'select';
    }

    render() {
        const { node } = this;
        const jsonData = this.data;

        const uiDiv = document.createElement('div');
        uiDiv.setAttribute('id', this.getComponentId());

        if (this.getDisplayStyle() === 'select') {
            uiDiv.className = 'ui fluid selection';
            if (jsonData['@search']) {
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
            $('#submit').click(() => {
                console.log(this.getSelectedValue());
            });
        } else if (this.getDisplayStyle() === 'labeled' || this.getDisplayStyle() === 'labeled multiple' || this.getDisplayStyle() === 'labeled dropdown') {
            uiDiv.className = 'ui floating labeled icon dropdown button';
            if (this.getDisplayStyle() === 'labeled multiple') {
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

            if (this.getDisplayStyle() === 'labeled dropdown') {
                for (const key of Object.keys(jsonData['>'])) {
                    const itemDiv = document.createElement('div');
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = 'item';
                    menuDiv.append(itemDiv);
                    node.append(uiDiv);
                }
                $('#submit').click(() => {
                    console.log(this.getSelectedValue());
                });
                $(`#${this.getComponentId()}`).dropdown();
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
            // callback
            $('#submit').click(() => {
                console.log(this.getSelectedValue());
            });
        } else if (this.getDisplayStyle() === 'multiple select') {
            $(uiDiv).removeAttr('id');
            const select = document.createElement('select');
            select.className = 'ui fluid';
            select.setAttribute('name', jsonData['@title']);
            select.setAttribute('id', this.getComponentId());
            select.setAttribute('multiple', '');

            if (jsonData['@search']) {
                select.classList.add('search');
            }

            const defaultOption = document.createElement('option');
            defaultOption.textContent = jsonData['@defaultTitle'];
            defaultOption.setAttribute('value', '');
            select.appendChild(defaultOption);

            for (const key of Object.keys(jsonData['>'])) {
                if (jsonData['>'][key]['@title'].length > 0) {
                    const option = document.createElement('option');
                    option.setAttribute('value', jsonData['>'][key]['@dataValue']);
                    option.textContent = jsonData['>'][key]['@title'];
                    select.append(option);
                }
            }
            select.classList.add('dropdown');
            uiDiv.appendChild(select);
            $('#submit').click(() => {
                console.log(this.getSelectedValue());
            });
        } else if (this.getDisplayStyle() === 'radio' || this.getDisplayStyle() === 'checkbox') {
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
                    innerUiDiv.classList.add(this.getDisplayStyle());
                    innerUiDiv.classList.add('checkbox');
                    fieldDiv.appendChild(innerUiDiv);
                    const innerInputDiv = document.createElement('input');
                    innerInputDiv.type = this.getDisplayStyle();
                    innerInputDiv.name = this.data['@title'];
                    innerInputDiv.id = `${this.data['@title']}-${data['@id']}`;
                    innerUiDiv.appendChild(innerInputDiv);
                    const innerLabel = document.createElement('label');
                    innerLabel.textContent = data['@title'];
                    innerUiDiv.appendChild(innerLabel);
                    alignmentDiv.appendChild(fieldDiv);
                });
            }
            // callback
            $('#submit').click(() => {
                console.log(this.getCheckedValue());
            });
        }

        node.append(uiDiv);
        try {
            $(`#${this.getComponentId()}`)
                .dropdown();
            // eslint-disable-next-line no-empty
        } catch (e) { }
    }
}
module.exports = Select;
