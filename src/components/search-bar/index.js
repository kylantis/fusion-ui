
class SearchBar extends BaseComponent {
    tagName() {
        return 'searchBar';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/icon.min.css', '/assets/css/input.min.css',
            '/assets/css/search.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/search.min.js']);
    }

    getValue(event) {
        console.log(event.target.value);
        return event.target.value;
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui category ';
        const inputTag = document.createElement('input');

        const searchBarIds = [];
        let id;
        if (jsonData['@id']) {
            id = jsonData['@id'];
        } else {
            id = `${node.getAttribute('id')}-${this.getRandomInt()}`;
        }
        uiDiv.setAttribute('id', id);

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

        searchBarIds.push(`#${id}`);
        uiDiv.setAttribute('id', id);
        $(uiDiv).on('keypress', (e) => {
            this.getValue(e);
        });
        uiDiv.classList.add('search');
        node.append(uiDiv);

        const suggestData = jsonData['>'];

        // suggestData = suggestData.map(json => ({
        //     title: json['@title'],
        // }));

        if (jsonData['@autoComplete']) {
            $('.ui.search')
                .search({
                    source: suggestData,
                });
        }
    }
}
module.exports = SearchBar;
