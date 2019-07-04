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

    render() {
        const { node } = this;
        const jsonData = this.data;
        const progressBarIds = [];

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

        const id = `${uiDiv.getAttribute('id')}-${this.getRandomInt()}`;

        $(uiDiv).on('click', () => {
            $(`#${id}`).progress('increment');
        });
        progressBarIds.push(`#${id}`);
        uiDiv.setAttribute('id', id);
        uiDiv.setAttribute('data-value', 60);
        uiDiv.setAttribute('data-total', 100);

        node.append(uiDiv);
    }
}
module.exports = ProgressBar;
