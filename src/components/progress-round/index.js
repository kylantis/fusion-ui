class ProgressRound extends BaseComponent {
    tagName() {
        return 'roundProgressBar';
    }

    componentId = this.getId();

    getCssDependencies() {
        return (['/assets/css/roundprogress.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/roundprogress.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node, data } = this;

        const mainDiv = document.createElement('div');
        const progress = this.appendNode(mainDiv, 'div', 'progress-bar round position');
        progress.id = data['@id'];
        progress.setAttribute('data-percent', data['@data-value']);
        progress.setAttribute('data-color', data['@data-color']);
        node.append(mainDiv);
        $('.progress-bar').loading();
    }
}

module.exports = ProgressRound;
