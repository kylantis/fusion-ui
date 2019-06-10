class SearchBar extends BaseComponent {

    constructor(data, node) {
        super(data, node);
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/css/icon.css', '/css/input.css', '/css/search.css');
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies();
        baseDependencies.push('/js/search.js');
        return baseDependencies;
    }

    render(node) {
        node = this.node;
        let jsonData = this.data;
        let uiDiv = document.createElement('div');
        uiDiv.className = "ui category ";
        let inputTag = document.createElement('input');

        let searchBarIds = [];
        uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);

        if (jsonData['@searchIcon']) {
            let iconDiv = document.createElement('div');
            inputTag.className = "prompt";
            inputTag.setAttribute('type', 'text');
            inputTag.setAttribute('placeholder', jsonData['@placeholder']);
            uiDiv.appendChild(iconDiv);
            iconDiv.appendChild(inputTag);
            iconDiv.className = "ui icon input";
            let iTag = document.createElement('i');
            iTag.className = "search icon";
            iconDiv.append(iTag);
            let resultDiv = document.createElement('div');
            resultDiv.className = "results";
            uiDiv.append(resultDiv);
        } else {
            inputTag.className = "prompt";
            inputTag.setAttribute('type', 'text');
            inputTag.setAttribute('placeholder', jsonData['@placeholder']);
            uiDiv.appendChild(inputTag);
            let resultDiv = document.createElement('div');
            resultDiv.className = "results";
        }
        if (jsonData['@size'].length > 0) {
            uiDiv.classList.add(jsonData['@size']);
        }
        if (jsonData['@disabled']) {
            uiDiv.classList.add("disabled");
        }

        const id = uiDiv.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);
        searchBarIds.push('#' + id);
        uiDiv.setAttribute("id", id);

        uiDiv.classList.add("search");
        node.append(uiDiv);

        let suggestData = jsonData['>'];

        suggestData = suggestData.map(json => {
            return {
                title: json['@title']
            }
        });

        if (jsonData['@autoComplete']) {
            $('.ui.search')
                .search({
                    source: suggestData
                });
        }

    }

}
