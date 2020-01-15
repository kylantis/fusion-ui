
class Card extends BaseComponent {
    tagName() {
        return 'card';
    }

    componentId = this.getId();

    getCssDependencies() {
        // return super.getCssDependencies().concat(['/assets/css/card.min.css', '/assets/css/grid.min.css', '/assets/css/segment.min.css', '/assets/css/dropdown.min.css', '/assets/css/icon.min.css', '/assets/css/transition.min.css', '/assets/css/dimmer.min.css', '/assets/css/custom-card.min.css', '/assets/css/custom-spinner.min.css']);
        return super.getCssDependencies().concat(['/assets/css/card-card.min.css', '/assets/css/icon.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/dropdown.min.js', '/assets/js/transition.min.js', '/assets/js/dimmer.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    invokeBehavior(behavior, data) {
        switch (behavior) {
        case 'click':
            data['@clientCallbacks'].apply(this);
            this.triggerEvent('click', data, this.data);
            break;

        default:
            break;
        }
    }

    click(data) {
        this.invokeBehavior('click', data);
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
                this.click(option);
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
        if (data['@raised']) {
            cardDiv.classList.add('raised');
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
        this.generateOptions(menuDiv, data['@dropdownOptions'], actualContainer);
        if (data['@overflow']) {
            componentContainer.style.overflow = data['@overflow'];
        }
        this.loadSpinner(actualContainer);
        BaseComponent.getComponent(data['@componentTag'], data['@componentData'], actualContainer);
        node.append(cardDiv);
        $(burger).dropdown();
        this.mutationOb(actualContainer);

        if (data['@cardType'] === 'cardButtons') {
            const gridCardDiv = document.createElement('div');
            gridCardDiv.className = 'ui fluid container card customCardClass';
            const gridDiv = this.appendNode(gridCardDiv, 'div', 'ui equal width cCardGrid grid');
            const row = this.appendNode(gridDiv, 'div', 'row');
            data['>'].forEach((el) => {
                const columnDiv = document.createElement('div');
                columnDiv.className = 'column center aligned';
                if (el['@width']) {
                    columnDiv.className += ` ${el['@width']} wide`;
                }
                const div = this.appendNode(columnDiv, 'div', 'cardbutton');
                const seg = this.appendNode(div, 'div', 'ui segment');
                const contentDivTwo = this.appendNode(seg, 'div', 'content hoverablecontent');
                // eslint-disable-next-line no-unused-vars
                const icon = this.appendNode(contentDivTwo, 'i', `${el['@icon']} icon big cardIcon`);
                const text = this.appendNode(contentDivTwo, 'div', 'header');
                text.textContent = el['@text'];
                row.append(columnDiv);
                contentDivTwo.addEventListener('click', () => {
                    this.click(el);
                });
            });
            node.appendChild(gridCardDiv);
            this.isRendered(this.getComponentId());
        }
    }
}
module.exports = Card;
