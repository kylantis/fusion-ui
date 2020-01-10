class ProgressCard extends BaseComponent {
    tagName() {
        return 'progressCard';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/progress.min.css', '/assets/css/custom-progress-card.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/progress.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    invokeBehavior(behavior, data) {
        switch (behavior) {
        case 'increment':
            $(`#${this.getComponentId()}bar`).progress('increment');
            this.triggerEvent('increment', { increment: true }, this.data);
            break;
        case 'decrement':
            $(`#${this.getComponentId()}bar`).progress('decrement');
            this.triggerEvent('decrement', { decrement: true }, this.data);
            break;
        case 'setPercent':
            return $(`#${this.getComponentId()}bar`).progress('set percent', data);
        case 'reset':
            $(`#${this.getComponentId()}bar`).progress('reset');
            break;
        case 'complete':
            $(`#${this.getComponentId()}bar`).progress('complete');
            break;
        case 'getPercent':
            return $(`#${this.getComponentId()}bar`).progress('get percent');
        case 'getValue':
            return $(`#${this.getComponentId()}bar`).progress('get value');
        default:
            break;
        }
        return false;
    }

    increment() {
        this.invokeBehavior('increment');
        this.updateProgressText();
    }

    decrement() {
        this.invokeBehavior('decrement');
    }

    setPercent() {
        this.invokeBehavior('setPercent', this.data['@data-value']);
    }

    reset() {
        this.invokeBehavior('reset');
    }

    complete() {
        this.invokeBehavior('complete');
    }

    getPercent() {
        return this.invokeBehavior('getPercent');
    }

    getValue() {
        return this.invokeBehavior('getValue');
    }

    getText(text) {
        $(`#${this.getComponentId()}bar`).progress('get text', text);
    }

    updateProgressText() {
        $('.custompcmeta').html(`${this.getPercent()}%`);
    }

    render() {
        const { node, data } = this;
        const mainParent = document.createElement('kc-progress-card');
        const cardMain = document.createElement('div');
        cardMain.className = 'ui fluid card';
        cardMain.id = this.getComponentId();
        const contentDiv = this.appendNode(cardMain, 'div', 'content');
        const headerDiv = this.appendNode(contentDiv, 'div', 'header');
        headerDiv.textContent = data['@headerText'];
        const metaDiv = this.appendNode(contentDiv, 'div', 'meta custompcmeta');
        metaDiv.textContent = `${data['@data-value']}%`;
        const extraContent = this.appendNode(contentDiv, 'div', 'extra content');
        const progressMain = this.appendNode(extraContent, 'div', 'ui active tiny incard progress');
        if (data['@color']) {
            progressMain.classList.add(data['@color']);
            metaDiv.classList.add(data['@color']);
        }
        // eslint-disable-next-line no-unused-vars
        const barDiv = this.appendNode(progressMain, 'div', 'bar');
        const label = this.appendNode(progressMain, 'div', 'label');
        label.textContent = data['@activeLabel'];
        progressMain.setAttribute('id', `${this.getComponentId()}bar`);
        progressMain.setAttribute('data-value', data['@data-value']);
        progressMain.setAttribute('data-total', data['@data-total']);
        mainParent.appendChild(cardMain);
        node.append(mainParent);

        $(`#${this.getComponentId()}bar`)
            .progress({
                text: {
                    active: data['@activeLabel'],
                    warning: 'error encountered',
                },
            });
        $(`#${this.getComponentId()}bar`).progress({
            onSuccess: () => {
                $('.custompcmeta').css('color', '#21ba45');
            },
        });
        this.isRendered(this.getComponentId());
    }
}
module.exports = ProgressCard;
