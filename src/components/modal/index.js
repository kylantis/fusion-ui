class Modal extends BaseComponent {
    tagName() {
        return 'modal';
    }

    componentId = this.getId();

    getComponentId() {
        return this.componentId;
    }

    getCssDependencies() {
        if (this.data['@modalStyle'] === 'image') {
            return super.getCssDependencies().concat(['/assets/css/modal.min.css', '/assets/css/dimmer.min.css', '/assets/css/transition.min.css', '/assets/css/custom-modal.min.css']);
        }
        if (this.data['@modalStyle'] === 'notification') {
            return super.getCssDependencies().concat(['/assets/css/modal.min.css', '/assets/css/dimmer.min.css', '/assets/css/transition.min.css', '/assets/css/icon.min.css', '/assets/css/button-labeled.min.css']);
        }
        return super.getCssDependencies().concat(['/assets/css/modal.min.css', '/assets/css/dimmer.min.css', '/assets/css/transition.min.css', '/assets/css/icon.min.css', '/assets/css/button-labeled.min.css', '/assets/css/input.min.css', '/assets/css/form.min.css', '/assets/css/custom-modal.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/modal.min.js', '/assets/js/dimmer.min.js', '/assets/js/transition.min.js']);
    }

    invokeBehavior(behavior, data) {
        const id = data['@id'];
        switch (behavior) {
        case 'open':
            $(`#${id}`).modal('show');
            break;

        default:
            break;
        }
    }

    formResult = {
        sender: 'User',
        recepient: '',
        message: '',
    }

    openModal(data) {
        this.invokeBehavior('open', data);
    }

    validateEntry() {
        if (this.data['@modalStyle'] !== 'form') {
            return true;
        }
        if (this.formResult.sender.length > 0 && this.formResult.message.length > 0
            && this.formResult.recepient.length > 0) {
            return true;
        }
        $('.ui.modal').modal({ onApprove: () => false });
        return false;
    }

    buttonClicked(clicked) {
        if (clicked) {
            this.data['@clientCallbacks']();
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
            if (this.validateEntry()) {
                $('.ui.modal').modal('hide');
                this.buttonClicked(true);
            }
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
            const imageDiv = this.appendNode(uiDiv, 'div', 'ui');
            if (jsonData['@size']) {
                imageDiv.classList.add(jsonData['@size']);
            }
            imageDiv.classList.add('image');
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

        if (jsonData['@modalStyle'] === 'form') {
            // eslint-disable-next-line no-unused-vars
            const closeIcon = document.createElement('i');
            closeIcon.className = 'close icon';
            uiDiv.prepend(closeIcon);
            headerDiv.textContent = jsonData['@title'];
            const contentDiv = this.appendNode(uiDiv, 'div', 'content');
            const formDiv = this.appendNode(contentDiv, 'div', 'ui form');
            const formHead = this.appendNode(formDiv, 'h4', 'ui dividing header');
            formHead.textContent = 'Write a message';
            const nameField = this.appendNode(formDiv, 'div', 'field');
            const nameLabel = this.appendNode(nameField, 'label', null);
            nameLabel.textContent = 'Name';
            const nameInput = this.appendNode(nameField, 'input', null);
            nameInput.type = 'text';
            nameInput.placeholder = 'Enter a name';
            $(nameInput).on('focusout', () => {
                if ($(nameInput).val().trim().length < 1) {
                    nameField.classList.add('error');
                } else {
                    nameField.classList.remove('error');
                    this.formResult.recepient = $(nameInput).val();
                }
            });
            const textField = this.appendNode(formDiv, 'div', 'field');
            const textAreaLabel = this.appendNode(textField, 'label', null);
            textAreaLabel.textContent = 'Message';
            // eslint-disable-next-line no-unused-vars
            const textarea = this.appendNode(textField, 'textarea', null);
            $(textarea).on('focusout', () => {
                if ($(textarea).val().trim().length < 1) {
                    textField.classList.add('error');
                } else {
                    textField.classList.remove('error');
                    this.formResult.message = $(textarea).val();
                }
            });
            const actionsDiv = this.appendNode(uiDiv, 'div', 'actions');
            this.modalButton(actionsDiv, jsonData);
        }

        if (jsonData['@size']) {
            uiDiv.classList.add(jsonData['@size']);
        }

        uiDiv.classList.add('modal');
        node.append(uiDiv);
    }
}
module.exports = Modal;
