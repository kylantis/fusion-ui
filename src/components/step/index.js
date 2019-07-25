class Step extends BaseComponent {
    tagName() {
        return 'step';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/step.min.css', '/assets/css/icon.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    setCompleted(event) {
        return (() => {
            $(event.target).addClass('completed');
        })();
    }

    activeStep(event) {
        return (() => {
            $(event.target).addClass('active');
            $(event.target).siblings().removeClass('active');
        })();
    }

    render() {
        const { node } = this;
        const uiDiv = document.createElement('div');
        let id;
        if (this.data['@id']) {
            id = this.data['@id'];
        } else {
            id = `${node.getAttribute('id')}-${this.getRandomInt()}`;
        }
        uiDiv.setAttribute('id', id);
        uiDiv.className = 'ui fluid steps';
        this.data['>'].forEach((element) => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'step';
            stepDiv.id = element['@stepId'];
            const iconDiv = document.createElement('i');
            const contentDiv = document.createElement('div');
            iconDiv.className = `${element['@icon']} icon`;
            contentDiv.className = 'content';
            stepDiv.appendChild(iconDiv);
            stepDiv.appendChild(contentDiv);
            const titleDiv = document.createElement('div');
            contentDiv.append(titleDiv);
            const descDiv = document.createElement('div');
            contentDiv.append(descDiv);
            titleDiv.className = 'title';
            descDiv.className = 'description';
            titleDiv.textContent = element['@title'];
            descDiv.textContent = element['@desc'];
            uiDiv.appendChild(stepDiv);
            $(stepDiv).click((event) => { this.activeStep(event); });
            $(stepDiv).click((event) => { this.setCompleted(event); });
        });
        node.append(uiDiv);
    }
}

module.exports = Step;
