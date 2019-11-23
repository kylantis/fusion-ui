class ProgressBar extends BaseComponent {
    tagName() {
        return 'progressBar';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/progress.min.css', '/assets/css/custom-progress-bar.min.css']);
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
            $(`#${this.getComponentId()}`).progress('increment');
            break;
        case 'decrement':
            $(`#${this.getComponentId()}`).progress('decrement');
            break;
        case 'setPercent':
            return $(`#${this.getComponentId()}`).progress('set percent', data);
        case 'reset':
            $(`#${this.getComponentId()}`).progress('reset');
            break;
        case 'complete':
            $(`#${this.getComponentId()}`).progress('complete');
            break;
        case 'getPercent':
            return $(`#${this.getComponentId()}`).progress('get percent');
        case 'getValue':
            $(`#${this.getComponentId()}`).progress('get value');
            break;
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
        this.invokeBehavior('getValue');
    }

    getText(text) {
        $(`#${this.getComponentId()}`).progress('get text', text);
    }

    updateProgressText() {
        console.log(this.getPercent());
        $('.metabar').html(`${this.getPercent()}%`);
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        const uiDiv = document.createElement('div');
        const barDiv = document.createElement('div');
        const progressDiv = document.createElement('div');
        const labelDiv = document.createElement('div');

        uiDiv.className = 'ui';
        if (jsonData['@state'].length > 0) {
            uiDiv.classList.add(jsonData['@state']);
        }
        if (jsonData['@type'].length > 0) {
            uiDiv.classList.add(jsonData['@type']);
        }
        if (jsonData['@size']) {
            uiDiv.classList.add(jsonData['@size']);
        }
        uiDiv.append(barDiv);
        barDiv.className = 'bar';
        barDiv.appendChild(progressDiv);
        progressDiv.className = 'progress';

        if (jsonData['@label'].length > 0) {
            uiDiv.append(labelDiv);
            labelDiv.className = 'label';
            labelDiv.innerHTML = jsonData['@label'];
        }

        if (jsonData['@percentText']) {
            const text = document.createElement('div');
            text.className = 'metabar';
            node.prepend(text);
            text.textContent = `${jsonData['@data-value']}%`;
            $(progressDiv).remove();
            if (jsonData['@color']) {
                text.classList.add(jsonData['@color']);
            }
        }

        if (jsonData['@color']) {
            uiDiv.classList.add(jsonData['@color']);
        }

        uiDiv.classList.add('progress');

        $(uiDiv).on('click', () => {
            console.log(this.getText('hello'));
        });
        uiDiv.setAttribute('id', `${this.getComponentId()}`);
        uiDiv.setAttribute('data-value', jsonData['@data-value']);
        uiDiv.setAttribute('data-total', jsonData['@data-total']);

        node.append(uiDiv);
    }
}
module.exports = ProgressBar;
