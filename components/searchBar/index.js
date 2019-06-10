class SearchBar extends BaseComponent {
    constructor(data, node) {
        super(data, node);
        this.data = data;
        this.node = node;
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push(['/css/search.css']);
        baseDependencies.push(['/css/icon.css']);
        baseDependencies.push(['/css/input.css']);
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies();
        // baseDependencies.push(['/js/search.js']);
        return baseDependencies;
    }

    content = [
        { title: 'Afghanistan' },
        { title: 'Andorra' },
        { title: 'Antigua' },
        { title: 'Anguilla' },
        { title: 'Albania' },
        { title: 'Armenia' },
        { title: 'Netherlands Antilles' },
        { title: 'Angola' },
        { title: 'Argentina' },
        { title: 'American Samoa' },
        { title: 'Austria' },
        { title: 'Australia' },
        { title: 'Aruba' },
        { title: 'Aland Islands' },
        { title: 'Azerbaijan' },
        { title: 'Bosnia' },
        { title: 'Barbados' },
        { title: 'Bangladesh' },
        { title: 'Belgium' },
        { title: 'Burkina Faso' },
        { title: 'Bulgaria' },
        { title: 'Bahrain' },
        { title: 'Burundi' },
        { title: 'Nigeria' },
        { title: 'United Arab Emirates' }
    ];

    // autoComplete() {
    //     $('.ui.search')
    //     .search({
    //         source: this.content
    //     });
    // }

    render(node) {
        node = this.node;
        let jsonData = this.data;
        let uiDiv = document.createElement('div');
        uiDiv.className="ui category ";
        let inputTag = document.createElement('input');

        let searchBarIds = [];
        uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);

        if(jsonData['@searchIcon']) {
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
            resultDiv.className="results";
            uiDiv.append(resultDiv);
        } else {
            inputTag.className = "prompt";
            inputTag.setAttribute('type', 'text');
            inputTag.setAttribute('placeholder', jsonData['@placeholder']);
            uiDiv.appendChild(inputTag);
            let resultDiv = document.createElement('div');
            resultDiv.className="results";
        }
        if(jsonData['@size'].length > 0) {
            uiDiv.classList.add(jsonData['@size']);
        }
        if(jsonData['@disabled']) {
            uiDiv.classList.add("disabled");
        }

        const id = uiDiv.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);
        searchBarIds.push('#' + id);
        uiDiv.setAttribute("id", id);

        uiDiv.classList.add("search");
        node.append(uiDiv);

        // if(jsonData['@autoComplete']) {
        //     this.autoComplete();
        // }
    }
    
}
