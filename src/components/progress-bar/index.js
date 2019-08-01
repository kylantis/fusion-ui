class ProgressBar extends BaseComponent {
    tagName() {
        return 'progressBar';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/progress.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/progress.min.js']);
    }

    #componentId;

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
            $(`#${this.getComponentId()}`).progress('get percent');
            break;
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
        this.invokeBehavior('getPercent');
    }

    getValue() {
        this.invokeBehavior('getValue');
    }

    getText(text) {
        $(`#${this.getComponentId()}`).progress('get text', text);
    }

    setComponentId() {
        if (this.data['@id']) {
            this.componentId = this.data['@id'];
        } else {
            this.componentId = this.generateId();
        }
        return this.componentId;
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        const progressBarIds = [];
        const id = this.setComponentId();
        const uiDiv = document.createElement('div');
        const barDiv = document.createElement('div');
        const progressDiv = document.createElement('div');
        const labelDiv = document.createElement('div');
        uiDiv.setAttribute('id', `${node.getAttribute('id')}`);

        uiDiv.className = 'ui';
        if (jsonData['@state'].length > 0) {
            uiDiv.classList.add(jsonData['@state']);
        }
        if (jsonData['@type'].length > 0) {
            uiDiv.classList.add(jsonData['@type']);
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

        uiDiv.classList.add('progress');

        $(uiDiv).on('click', () => {
            console.log(this.getText('hello'));
        });
        progressBarIds.push(`#${id}`);
        uiDiv.setAttribute('id', id);
        uiDiv.setAttribute('data-value', jsonData['@data-value']);
        uiDiv.setAttribute('data-total', jsonData['@data-total']);

        node.append(uiDiv);
    }
}
module.exports = ProgressBar;
