
class ChartCard extends BaseComponent {
    tagName() {
        return 'chartCard';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/card.min.css', '/assets/css/icon.min.css', '/assets/css/custom-chartcard.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    getComponentId() {
        return this.componentId;
    }

    invokeBehavior(...args) {
        const [
            behavior, argOne, argTwo, argThree,
        ] = args;
        const { data } = this;
        switch (behavior) {
        case 'updateCard': {
            const valueArray = [];
            const card = document.getElementById(data['@id']);
            const cid = card.querySelector(`#${argOne}`);
            const indicatorEl = cid.querySelector('.icon');
            const presentValEl = cid.querySelector('.presentVal');
            const percentValEl = cid.querySelector('.percentVal');
            valueArray.push(presentValEl.textContent);
            let indicator;
            if (valueArray[0] > argTwo) {
                indicator = 'up';
            } else {
                indicator = 'down';
            }
            valueArray.splice(0, 1, argTwo);
            if (!indicatorEl.classList.contains('indicator')) {
                indicatorEl.classList.remove('up');
                indicatorEl.classList.remove('down');
                indicatorEl.classList.add(indicator);
                if (indicator === 'up') {
                    indicatorEl.classList.add('green');
                    indicatorEl.classList.remove('red');
                } else if (indicator === 'down') {
                    indicatorEl.classList.add('red');
                    indicatorEl.classList.remove('green');
                }
            }
            if (argThree !== undefined) {
                percentValEl.textContent = argThree;
            }
            if (argTwo !== undefined) {
                presentValEl.textContent = argTwo;
            }
            break;
        }
        case 'addCard': {
            const card = document.getElementById(data['@id']);
            this.generateCards(card, argTwo);
            break;
        }
        default:
            break;
        }
    }

    updateValues(cardId, presentValue, percentValue) {
        this.invokeBehavior('updateCard', cardId, presentValue, percentValue);
    }

    addCard(parent, data) {
        this.invokeBehavior('addCard', parent, data);
    }

    generateCards(parent, optionData) {
        optionData.forEach((option) => {
            const oneCard = document.createElement('div');
            oneCard.className = 'ui raised chartCard card';
            oneCard.id = option['@id'];
            const contentDiv = this.appendNode(oneCard, 'div', 'content');
            const metaDiv = this.appendNode(contentDiv, 'div', 'meta');
            metaDiv.textContent = option['@title'];
            const headerDiv = this.appendNode(contentDiv, 'div', 'header');
            // eslint-disable-next-line no-unused-vars
            const iconDiv = this.appendNode(headerDiv, 'i', `large ${option['@indicatorIcon']} angle icon`);
            if (option['@indicatorIcon'] === 'up') {
                iconDiv.className += ' green';
            }
            if (option['@indicatorIcon'] === 'down') {
                iconDiv.className += ' red';
            }
            const spanCur = document.createElement('span');
            spanCur.className = 'currencySymbol';
            spanCur.textContent = option['@currency'];
            headerDiv.append(spanCur);
            const headerText = document.createElement('div');
            headerText.className = 'headerText presentVal';
            headerText.textContent = option['@presentValue'];
            headerDiv.appendChild(headerText);
            const percentSpan = this.appendNode(contentDiv, 'span', 'right floated percentVal');
            percentSpan.textContent = option['@percentageValue'];
            parent.append(oneCard);
        });
    }

    render() {
        const { node, data } = this;
        const cardDiv = document.createElement('div');
        cardDiv.id = this.getComponentId();
        cardDiv.className = 'ui chartCards cards';
        this.generateCards(cardDiv, data['>']);
        node.append(cardDiv);
        setTimeout(() => {
            this.updateValues('chartCardOne', '323230', '-54%');
        }, 1000);
        setTimeout(() => {
            this.updateValues('chartCardOne', '323233', '-54%');
        }, 2000);
        setTimeout(() => {
            this.updateValues('chartCardFour', '323220', '-54%');
        }, 3000);
    }
}
module.exports = ChartCard;
