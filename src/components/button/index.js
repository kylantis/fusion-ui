// eslint-disable-next-line no-unused-vars
class Button extends BaseComponent {
    tagName() {
        return 'button';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/assets/css/icon.min.css', '/assets/css/button.min.css');
        return baseDependencies;
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        const button = document.createElement('button');
        const buttonId = [];
        button.setAttribute('id', `${node.getAttribute('id')}-component`);


        if (jsonData['@buttonStyle'] === 'basic' || jsonData['@buttonStyle'].length < 1) {
            button.className = `${jsonData['@size']} ui button `;
            button.className += `${jsonData['@type']} ${jsonData['@color']}`;
            button.textContent = jsonData['@buttonText'];
        } else if (jsonData['@buttonStyle'] === 'animated') {
            const visibleDiv = document.createElement('div');
            const hiddenDiv = document.createElement('div');
            const itag = document.createElement('i');

            button.className = `ui animated button ${jsonData['@size']}`;
            button.classList.add(jsonData['@transition']);
            button.setAttribute('tab-index', jsonData['@tabIndex']);
            button.appendChild(visibleDiv);
            visibleDiv.className = 'visible content';
            visibleDiv.innerHTML = jsonData['@buttonText'];
            if (jsonData['@iconName'].length > 0) {
                button.appendChild(hiddenDiv);
                hiddenDiv.className = 'hidden content';
                hiddenDiv.appendChild(itag);
                itag.className = 'icon ';
                itag.className += jsonData['@iconName'];
            } else {
                button.appendChild(hiddenDiv);
                hiddenDiv.className = 'hidden content';
                hiddenDiv.textContent = jsonData['@transitionContent'];
            }
        } else if (jsonData['@buttonStyle'] === 'labeled') {
            const iTag = document.createElement('i');
            button.className = `ui ${jsonData['@size']}`;
            button.classList.add(jsonData['@iconPosition']);
            button.className += ' labeled icon button';
            button.textContent = jsonData['@buttonText'];
            button.appendChild(iTag);
            iTag.className = 'icon ';
            iTag.className += jsonData['@iconName'];
        } else if (jsonData['@buttonStyle'] === 'icon') {
            const iTag = document.createElement('i');
            button.className = `ui icon button ${jsonData['@size']}`;
            button.appendChild(iTag);
            iTag.className += 'icon ';
            iTag.className += (jsonData['@iconName'] || jsonData['@socialButton']);
        } else if (jsonData['@buttonStyle'] === 'circular') {
            const iTag = document.createElement('i');
            button.className = `${jsonData['@size']} circular ui icon button`;
            button.appendChild(iTag);
            iTag.className = 'icon ';
            iTag.className += jsonData['@iconName'];
        } else if (jsonData['@buttonStyle'] === 'outline') {
            button.className = 'ui inverted ';
            if (jsonData['@size'].length > 1) {
                button.classList.add(jsonData['@size']);
            }
            button.textContent = jsonData['@buttonText'];
            if (jsonData['@type'].length > 1) {
                button.classList.add(jsonData['@type']);
                if (jsonData['@color'].length > 1) {
                    button.classList.add(jsonData['@color']);
                }
                button.className += ' button';
            } else if (jsonData['@color'].length > 1) {
                button.className += `${jsonData['@color']} button`;
            }
        } else if (jsonData['@buttonStyle'] === 'disabled') {
            button.className = `ui disabled button ${jsonData['@size']}`;
            const iTag = document.createElement('i');
            button.textContent = jsonData['@buttonText'];
            button.appendChild(iTag);
            iTag.className = jsonData['@iconName'];
        } else if (jsonData['@buttonStyle'] === 'social') {
            button.className = `ui ${jsonData['@socialButton']}`;
            const iTag = document.createElement('i');
            button.textContent = jsonData['@socialButton'];
            button.prepend(iTag);
            iTag.className = jsonData['@socialButton'];
            iTag.classList.add('icon');
            button.classList.add('button');
        }

        const id = `${button.getAttribute('id')}-${this.getRandomInt()}`;
        buttonId.push(`#${id}`);
        button.setAttribute('id', id);

        node.append(button);
    }
}
