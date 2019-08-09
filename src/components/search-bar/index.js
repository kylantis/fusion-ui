
class SearchBar extends BaseComponent {
    tagName() {
        return 'searchBar';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/input.min.css', '/assets/css/search.min.css', '/assets/css/icon.min.css',
            '/assets/css/custom-search.min.css']);
    }

    // getJsDependencies() {
    //     return super.getJsDependencies().concat(['/assets/js/search.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jquery-easing/1.4.1/jquery.easing.min.js']);
    // }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/search.min.js', '/cdn/jqueryeasing.min.js']);
    }

    invokeBehavior(behavior, data) {
        switch (behavior) {
        case 'autoSuggest':
            $(`#${this.getComponentId()}`).search({ source: data });
            break;
        case 'query':
            this.queryServer(data);
            break;
        case 'getValue':
            return $(`#${this.getComponentId()}`).search('get value');
        case 'getResult':
            return $(`#${this.getComponentId()}`).search('get result');
        default:
            break;
        }
        return false;
    }

    autoSuggest(suggestedData) {
        this.invokeBehavior('autoSuggest', suggestedData);
    }

    query(searchinput) {
        this.invokeBehavior('query', searchinput);
    }

    // queryServer(data) {

    // }

    getValue() {
        return this.invokeBehavior('getValue');
    }

    getResult() {
        return this.invokeBehavior('getResult');
    }

    getComponentId() {
        return this.#componentId;
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui ';
        const inputTag = document.createElement('input');

        uiDiv.setAttribute('id', this.getComponentId());

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

        uiDiv.classList.add('search');
        node.append(uiDiv);

        if (jsonData['>'] && jsonData['@autoComplete']) {
            let suggestData = jsonData['>'];

            suggestData = suggestData.map(json => ({
                title: json['@title'],
            }));
            this.autoSuggest(suggestData);
        }
    }
}
module.exports = SearchBar;
