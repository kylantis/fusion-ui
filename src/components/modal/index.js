class Modal extends BaseComponent {
    tagName() {
        return 'modal';
    }

    #componentId = this.getId();

    getComponentId() {
        return this.#componentId;
    }

    getCssDependencies() {
        if (this.data['@modalStyle'] === 'image') {
            return super.getCssDependencies().concat(['/assets/css/modal.min.css', '/assets/css/dimmer.min.css', '/assets/css/transition.min.css', '/assets/css/custom-modal.min.css']);
        }
        return super.getCssDependencies().concat(['/assets/css/modal.min.css', '/assets/css/dimmer.min.css', '/assets/css/transition.min.css', '/assets/css/icon.min.css', '/assets/css/button.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/modal.min.js', '/assets/js/dimmer.min.js', '/assets/js/transition.min.js']);
    }

    invokeBehavior(behavior) {
        switch (behavior) {
        case 'open':
            $('.ui.modal').modal('show');
            break;

        default:
            break;
        }
    }

    openModal() {
        this.invokeBehavior('open');
    }

    buttonClicked(answer) {
        if (answer) {
            this.data['@clientCallback']();
        }
    }

    modalButton(parentDiv, data) {
        const denyButton = this.appendNode(parentDiv, 'div', 'ui black deny button');
        denyButton.textContent = data['@denyButtonText'];
        $(denyButton).click(() => {
            this.buttonClicked(false);
            $('.ui.modal').modal('hide');
        });
        const approveButton = this.appendNode(parentDiv, 'div', 'ui positive right labeled icon button');
        approveButton.textContent = data['@approveButtonText'];
        // eslint-disable-next-line no-unused-vars
        const approveButtonIcon = this.appendNode(approveButton, 'i', 'checkmark icon');
        $(approveButton).click(() => {
            this.buttonClicked(true);
            $('.ui.modal').modal('hide');
        });
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui';
        uiDiv.setAttribute('id', this.getComponentId());

        if (jsonData['@modalStyle'] === 'image') {
            uiDiv.classList.add('basic');
            const imageDiv = this.appendNode(uiDiv, 'div', 'ui large image');
            const imgTag = this.appendNode(imageDiv, 'img');
            imgTag.src = jsonData['@imageSrc'];
        }

        const headerDiv = this.appendNode(uiDiv, 'div', 'header');

        if (jsonData['@modalStyle'] === 'standard') {
            // eslint-disable-next-line no-unused-vars
            const closeIcon = this.appendNode(uiDiv, 'i', 'close icon');
            headerDiv.textContent = jsonData['@title'];
            const contentDiv = this.appendNode(uiDiv, 'div', 'image content');
            const imageDiv = this.appendNode(contentDiv, 'div', 'ui medium image');
            const imgTag = this.appendNode(imageDiv, 'img');
            imgTag.src = jsonData['@imageSrc'];
            imgTag.height = jsonData['@imageHeight'];
            imgTag.width = jsonData['@imageWidth'];
            const descDiv = this.appendNode(contentDiv, 'div', 'description');
            const contentHeader = this.appendNode(descDiv, 'div', 'ui header');
            contentHeader.textContent = jsonData['@descriptionHeader'];
            const actionsDiv = this.appendNode(uiDiv, 'div', 'actions');
            this.modalButton(actionsDiv, jsonData);
        }

        if (jsonData['@modalStyle'] === 'basic') {
            uiDiv.classList.add('basic');
            // eslint-disable-next-line no-unused-vars
            const iconDiv = this.appendNode(headerDiv, 'i', `${jsonData['@modalIcon']} icon`);
            const headingText = jsonData['@title'];
            headerDiv.append(headingText);
            const contentDiv = this.appendNode(uiDiv, 'div', 'content');
            contentDiv.textContent = jsonData['@descriptionText'];
            const actionsDiv = this.appendNode(uiDiv, 'div', 'actions');
            this.modalButton(actionsDiv, jsonData);
        }

        if (jsonData['@modalStyle'] === 'confirm') {
            const headingText = jsonData['@title'];
            headerDiv.append(headingText);
            const contentDiv = this.appendNode(uiDiv, 'div', 'content');
            contentDiv.textContent = jsonData['@descriptionText'];
            const actionsDiv = this.appendNode(uiDiv, 'div', 'actions');
            this.modalButton(actionsDiv, jsonData);
        }

        if (jsonData['@modalStyle'] === 'notification') {
            const headingText = jsonData['@title'];
            headerDiv.append(headingText);
            if (jsonData['@imageSrc']) {
                const contentDiv = this.appendNode(uiDiv, 'div', 'image content');
                const imageDiv = this.appendNode(contentDiv, 'div', 'ui image');
                const imgTag = this.appendNode(imageDiv, 'img');
                imgTag.src = jsonData['@imageSrc'];
                imgTag.height = jsonData['@imageHeight'];
                imgTag.width = jsonData['@imageWidth'];
                const descDiv = this.appendNode(contentDiv, 'div', 'description');
                const contentHeader = this.appendNode(descDiv, 'h4', 'ui header');
                contentHeader.textContent = jsonData['@descriptionHeader'];
                const pTag = this.appendNode(descDiv, 'p', null);
                pTag.append(jsonData['@descriptionText']);
            } else {
                const descDiv = this.appendNode(uiDiv, 'div', 'content');
                descDiv.textContent = jsonData['@descriptionText'];
            }
            const actionsDiv = this.appendNode(uiDiv, 'div', 'actions');
            const approveButton = this.appendNode(actionsDiv, 'div', `ui ${jsonData['@singleButtonColor']} button`);
            approveButton.textContent = jsonData['@singleButtonText'];
            $(approveButton).click(() => {
                $('.ui.modal').modal('hide');
            });
        }

        if (jsonData['@size']) {
            uiDiv.classList.add(jsonData['@size']);
        }

        uiDiv.classList.add('modal');
        node.append(uiDiv);
    }
}
module.exports = Modal;
