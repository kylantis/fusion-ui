class Rating extends BaseComponent {
    constructor(data, node) {
        super(data, node);
    }

    tagName() {
        return "rating";
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/css/rating.css', '/css/icon.css');
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies();
        baseDependencies.push('/js/rating.js');
        return baseDependencies;
    }

    render() {
        const node = this.node;

        let uiDiv = document.createElement('div');
        uiDiv.className = "ui";
        this.data['@displayStyle'].length > 0 ? uiDiv.classList.add(this.data['@displayStyle']) : "";
        this.data['@size'].length > 0 ? uiDiv.classList.add(this.data['@size']) : "";
        uiDiv.setAttribute("data-rating", this.data['@data-rating']);
        uiDiv.setAttribute("data-max-rating", this.data['@data-max-rating']);

        uiDiv.classList.add('rating')
        node.append(uiDiv);

        $('.ui.rating')
        .rating({
            initialRating: this.data['@data-rating'],
            maxRating: this.data['@data-max-rating']
        });
    }
}