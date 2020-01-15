class Spinner extends BaseComponent {
    tagName() {
        return 'spinner';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/custom-spinner.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    behaviorNames() {
        return [''];
    }

    deleteSpinner(id) {
        $(id).remove();
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const { data } = this;
        const mainDiv = document.createElement('div');
        mainDiv.id = data['@id'];
        switch (data['@spinnerType']) {
        case 'foldingCube': {
            mainDiv.className = 'sk-folding-cube';
            // eslint-disable-next-line no-unused-vars
            const cube1 = this.appendNode(mainDiv, 'div', 'sk-cube1 sk-cube');
            // eslint-disable-next-line no-unused-vars
            const cube2 = this.appendNode(mainDiv, 'div', 'sk-cube2 sk-cube');
            // eslint-disable-next-line no-unused-vars
            const cube3 = this.appendNode(mainDiv, 'div', 'sk-cube3 sk-cube');
            // eslint-disable-next-line no-unused-vars
            const cube4 = this.appendNode(mainDiv, 'div', 'sk-cube4 sk-cube');
            break;
        }
        case 'spinner': {
            mainDiv.className = 'sk-spinner sk-spinner-pulse';
            mainDiv.style.background = 'red';
            break;
        }
        case 'spinnerCircle': {
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
            break;
        }
        default:
            break;
        }
        node.append(mainDiv);
        this.isRendered(this.getComponentId());
    }
}

module.exports = Spinner;
