
class Card extends BaseComponent {
    tagName() {
        return 'card';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/card.min.css', '/assets/css/dropdown.min.css', '/assets/css/icon.min.css', '/assets/css/transition.min.css', '/assets/css/dimmer.min.css', '/assets/css/custom-card.min.css', '/assets/css/custom-spinner.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/dropdown.min.js', '/assets/js/transition.min.js', '/assets/js/dimmer.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    generateOptions(parent, optionData, container) {
        const { data } = this;
        const newCon = container;
        function refresh() {
            $(newCon).empty();
            BaseComponent.getComponent(data['@componentTag'], data['@componentData'], newCon);
        }

        const refreshDiv = this.appendNode(parent, 'div', 'item');
        refreshDiv.textContent = 'Refresh';
        refreshDiv.addEventListener('click', refresh);
        optionData.forEach((option) => {
            const div = document.createElement('div');
            div.className = 'item';
            div.textContent = option['@optionText'];
            div.addEventListener('click', () => {
                console.log('inside', this);
                option['@clientCallback'].apply(this);
            });
            parent.appendChild(div);
        });
    }

    mutationOb(el) {
        const { data } = this;
        function callback(mutations) {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes[0]) {
                    if (mutation.addedNodes[0].id === data['@componentData']['@id'] || mutations.length > 0) {
                        $('#inCardSpinner').remove();
                    }
                }
            });
        }
        const observer = new MutationObserver(callback);
        const config = {
            childList: true,
        };
        observer.observe(el, config);
    }

    loadSpinner(parent) {
        const mainDiv = document.createElement('div');
        mainDiv.id = 'inCardSpinner';
        mainDiv.className = 'sk-circle';
        const firstChild = this.appendNode(mainDiv, 'div', 'sk-circle1 sk-child');
        const secondChild = this.appendNode(mainDiv, 'div', 'sk-circle2 sk-child');
        const thirdChild = this.appendNode(mainDiv, 'div', 'sk-circle3 sk-child');
        const fourthChild = this.appendNode(mainDiv, 'div', 'sk-circle4 sk-child');
        const fifthChild = this.appendNode(mainDiv, 'div', 'sk-circle5 sk-child');
        const sixthChild = this.appendNode(mainDiv, 'div', 'sk-circle6 sk-child');
        const seventhChild = this.appendNode(mainDiv, 'div', 'sk-circle7 sk-child');
        const eightChild = this.appendNode(mainDiv, 'div', 'sk-circle8 sk-child');
        const ninethChild = this.appendNode(mainDiv, 'div', 'sk-circle9 sk-child');
        const tenthChild = this.appendNode(mainDiv, 'div', 'sk-circle10 sk-child');
        const eleventhChild = this.appendNode(mainDiv, 'div', 'sk-circle11 sk-child');
        const twelfthChild = this.appendNode(mainDiv, 'div', 'sk-circle12 sk-child');
        parent.appendChild(mainDiv);
    }

    render() {
        const { node, data } = this;
        const cardDiv = document.createElement('div');
        cardDiv.className = 'ui fluid container card';
        cardDiv.id = this.getComponentId();
        if (data['@maxHeight']) {
            cardDiv.style.maxHeight = data['@maxHeight'];
        }
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        cardDiv.appendChild(contentDiv);
        const burgerLink = this.appendNode(contentDiv, 'div', 'right floated');
        const burger = this.appendNode(burgerLink, 'div', 'ui icon top left pointing dropdown');
        // eslint-disable-next-line no-unused-vars
        const burgerIconTag = this.appendNode(burger, 'i', 'bars icon');
        const menuDiv = this.appendNode(burger, 'div', 'ui menu');
        // eslint-disable-next-line no-unused-vars
        const iconHeader = this.appendNode(contentDiv, 'i', `cardIcon ${data['@headerIcon']} icon`);
        const headerText = this.appendNode(contentDiv, 'div', 'header');
        headerText.textContent = data['@title'];
        const componentContainer = this.appendNode(cardDiv, 'div', 'extra content column');
        const actualContainer = this.appendNode(componentContainer, 'div', 'actualContainer');
        this.generateOptions(menuDiv, data['>'], actualContainer);
        if (data['@overflow']) {
            componentContainer.style.overflow = data['@overflow'];
        }
        this.loadSpinner(actualContainer);
        BaseComponent.getComponent(data['@componentTag'], data['@componentData'], actualContainer);
        node.append(cardDiv);
        $(burger).dropdown();
        this.mutationOb(actualContainer);
    }
}
module.exports = Card;
