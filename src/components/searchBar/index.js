// eslint-disable-next-line no-unused-vars
class SearchBar extends BaseComponent {
    tagName() {
        return 'searchBar';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/assets/css/icon.min.css', '/assets/css/input.min.css', '/assets/css/search.min.css');
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies();
        baseDependencies.push('/assets/js/search.min.js');
        return baseDependencies;
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui category ';
        const inputTag = document.createElement('input');

        const searchBarIds = [];
        uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);

        if (jsonData['@searchIcon']) {
            const iconDiv = document.createElement('div');
            inputTag.className = 'prompt';
            inputTag.setAttribute('type', 'text');
            inputTag.setAttribute('placeholder', jsonData['@placeholder']);
            uiDiv.appendChild(iconDiv);
            iconDiv.appendChild(inputTag);
            iconDiv.className = 'ui icon input';
            const iTag = document.createElement('i');
            iTag.className = 'search icon';
            iconDiv.append(iTag);
            const resultDiv = document.createElement('div');
            resultDiv.className = 'results';
            uiDiv.append(resultDiv);
        } else {
            inputTag.className = 'prompt';
            inputTag.setAttribute('type', 'text');
            inputTag.setAttribute('placeholder', jsonData['@placeholder']);
            uiDiv.appendChild(inputTag);
            const resultDiv = document.createElement('div');
            resultDiv.className = 'results';
        }
        if (jsonData['@size'].length > 0) {
            uiDiv.classList.add(jsonData['@size']);
        }
        if (jsonData['@disabled']) {
            uiDiv.classList.add('disabled');
        }

        const id = `${uiDiv.getAttribute('id')}-${this.getRandomInt()}`;
        searchBarIds.push(`#${id}`);
        uiDiv.setAttribute('id', id);

        uiDiv.classList.add('search');
        node.append(uiDiv);

        let suggestData = jsonData['>'];

        suggestData = suggestData.map(json => ({
            title: json['@title'],
        }));

        if (jsonData['@autoComplete']) {
            $('.ui.search')
                .search({
                    source: suggestData,
                });
        }
    }
}
