
class Select extends BaseComponent {
    tagName() {
        return 'select';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/assets/css/dropdown.min.css', '/assets/css/input.min.css', '/assets/css/button.min.css', '/assets/css/transition.min.css');
        if (this.data['@displayStyle'] === 'labeled' || 'labeled multiple' || 'labeled dropdown') {
            baseDependencies.push('/assets/css/icon.min.css', '/assets/css/label.min.css');
        }
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies();
        baseDependencies.push('/assets/js/dropdown.min.js', '/assets/js/transition.min.js');
        return baseDependencies;
    }

    render() {
        const { node } = this;
        const jsonData = this.data;

        let componentId = `${node.getAttribute('id')}-component`;

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
        }

        node.append(uiDiv);

        $(`#${componentId}`)
            .dropdown();
    }
}
module.exports = Select;
