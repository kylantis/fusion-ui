class Select extends BaseComponent {
    constructor(data, node) {
        super(data, node);
    }

    tagName() {
        return "select";
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/css/dropdown.css', '/css/icon.css', '/css/header.css', '/css/label.css', '/css/input.css', '/css/button.css');
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies();
        baseDependencies.push('/js/dropdown.js');
        return baseDependencies;
    }

    render() {
        const node = this.node;
        let jsonData = this.data;

        let componentId = `${node.getAttribute('id')}-component`;

        let uiDiv = document.createElement('div');
        uiDiv.setAttribute('id', componentId);

        if (jsonData['@displayStyle'] === "select" || jsonData['@displayStyle'] === "search select") {
            uiDiv.className = "ui fluid selection";
            if (jsonData['@displayStyle'] === "search selection") {
                uiDiv.classList.add("search");
            }

            let hiddenInput = document.createElement('input');
            hiddenInput.setAttribute('type', 'hidden');
            hiddenInput.setAttribute('name', jsonData['@title']);
            uiDiv.appendChild(hiddenInput);

            let iTag = document.createElement('i');
            iTag.className = "dropdown icon";

            let defaultTextDiv = document.createElement('div');
            defaultTextDiv.className = "default text";
            defaultTextDiv.innerHTML = jsonData['@title'];
            uiDiv.appendChild(iTag);
            uiDiv.appendChild(defaultTextDiv);

            let menuDiv = document.createElement('div');
            menuDiv.className = "menu";
            uiDiv.append(menuDiv);

            for (let key of Object.keys(jsonData['>'])) {
                if (jsonData['>'][key]['@imageUrl'].length > 0) {

                    let itemDiv = document.createElement('div');
                    let imgTag = document.createElement('img');
                    itemDiv.append(imgTag);
                    imgTag.className = "ui mini avatar image";
                    imgTag.setAttribute('src', jsonData['>'][key]['@imageUrl'])
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = "item";
                    itemDiv.setAttribute('data-value', jsonData['>'][key]['@dataValue'])
                    menuDiv.append(itemDiv);

                } else {

                    let itemDiv = document.createElement('div');
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = "item";
                    itemDiv.setAttribute('data-value', jsonData['>'][key]['@dataValue'])
                    menuDiv.append(itemDiv);

                }
            }

            if (jsonData['@isRequired']) {
                uiDiv.setAttribute("required", "");
            }
            uiDiv.classList.add("dropdown");
            node.append(uiDiv);

        } else if (jsonData['@displayStyle'] === "labeled" || jsonData['@displayStyle'] === "labeled multiple" || jsonData['@displayStyle'] === "labeled dropdown") {
            uiDiv.className = "ui floating labeled icon dropdown button";
            if (jsonData['@displayStyle'] === "labeled multiple") {
                uiDiv.classList.remove("floating");
                uiDiv.classList.remove("labeled");
                uiDiv.classList.remove("icon");
                uiDiv.classList.remove("button");
                uiDiv.classList.add("multiple");
            }

            let iTag = document.createElement('i');
            iTag.className = "filter icon";
            uiDiv.append(iTag);

            let textSpan = document.createElement('span');
            textSpan.className = "text";
            textSpan.innerHTML = "Filter Posts"; //to be changed to 
            uiDiv.append(textSpan);

            let menuDiv = document.createElement('div');
            menuDiv.className = "menu";
            uiDiv.append(menuDiv);

            if (jsonData['@displayStyle'] === "labeled dropdown") {
                for (let key of Object.keys(jsonData['>'])) {
                    let itemDiv = document.createElement('div');
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = "item";
                    menuDiv.append(itemDiv);
                    node.append(uiDiv);
                }
                return;
            }

            let searchDiv = document.createElement('div');
            searchDiv.className = "ui icon search input";
            menuDiv.append(searchDiv);

            let iSearchTag = document.createElement('i');
            searchDiv.append(iSearchTag);
            iSearchTag.className = "search icon";

            let searchInput = document.createElement('input');
            searchInput.setAttribute('type', 'text');
            searchInput.setAttribute('placeholder', 'Search Tags...');
            searchDiv.append(searchInput);

            let dividerDiv = document.createElement('div');
            dividerDiv.className = "divider";
            menuDiv.append(dividerDiv);

            let headerDiv = document.createElement('div');
            headerDiv.className = "header";
            menuDiv.append(headerDiv);

            let iTagIcon = document.createElement('i');
            iTagIcon.className = "tags icon";
            iTagIcon.innerHTML = "Tag Label";
            headerDiv.append(iTagIcon);

            let scrollingDiv = document.createElement('div');
            scrollingDiv.className = "scrolling menu";
            menuDiv.append(scrollingDiv);

            for (let key of Object.keys(jsonData['>'])) {
                if (jsonData['>'][key]['@dataValue'].length > 0) {
                    let itemDiv = document.createElement('div');
                    let classDiv = document.createElement('div');
                    classDiv.className = "ui empty circular label ";
                    classDiv.className += jsonData['>'][key]['@iconName'];
                    itemDiv.appendChild(classDiv);
                    itemDiv.setAttribute('data-value', jsonData['>'][key]['@dataValue']);
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = "item";
                    scrollingDiv.append(itemDiv);
                } else {
                    let itemDiv = document.createElement('div');
                    let classDiv = document.createElement('div');
                    classDiv.className = "ui empty circular label ";
                    classDiv.className += jsonData['>'][key]['@iconName'];
                    itemDiv.appendChild(classDiv);
                    itemDiv.append(jsonData['>'][key]['@title']);
                    itemDiv.className = "item";
                    scrollingDiv.append(itemDiv);
                }

            }

        } else if (jsonData['@displayStyle'] === "multiple select" || jsonData['@displayStyle'] === "multiple search select") {
            let select = document.createElement('select');
            select.className = "ui fluid";
            select.setAttribute('multiple', ' ');
            select.setAttribute('name', jsonData['@title']);
            jsonData['@displayStyle'] === "multiple search select" ? select.classList.add('search') : '';
            let defaultOption = document.createElement('option');
            defaultOption.textContent = jsonData['@defaultTitle'];
            defaultOption.setAttribute('value', '');
            select.appendChild(defaultOption);

            for (let key of Object.keys(jsonData['>'])) {
                if (jsonData['>'][key]['@title'].length > 0) {
                    let option = document.createElement('option');
                    option.setAttribute('value', jsonData['>'][key]['@title']);
                    option.textContent = jsonData['>'][key]['@title'];
                    select.append(option);
                }
            }
            select.classList.add('dropdown')
            uiDiv.appendChild(select);
            console.log(uiDiv)

            componentId += ' > .ui.dropdown';
        }

        node.append(uiDiv);

        $(`#${componentId}`)
            .dropdown();
    }

}
