
class Button extends BaseComponent {
    tagName() {
        return 'button';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/button.min.css', '/assets/css/icon.min.css']);
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        const button = document.createElement('button');
        const buttonId = [];
        let id;
        if (jsonData['@id']) {
            id = jsonData['@id'];
        } else {
            id = `${jsonData['@name']}-${this.getRandomInt()}`;
        }

        if (jsonData['@buttonStyle'] === 'basic' || jsonData['@buttonStyle'].length === 0) {
            button.className = `ui ${jsonData['@size']} button`;
            button.className += `${jsonData['@color']}`;
            button.textContent = jsonData['@buttonText'];
            if (jsonData['@position']) {
                button.classList.add(jsonData['@position']);
                button.classList.add('floated');
            }
        } else if (jsonData['@buttonStyle'] === 'animated') {
            const visibleDiv = document.createElement('div');
            const hiddenDiv = document.createElement('div');
            const itag = document.createElement('i');

            button.className = `ui animated button ${jsonData['@size']}`;
            button.classList.add(jsonData['@color']);
            button.classList.add(jsonData['@transition']);
            if (jsonData['@position']) {
                button.classList.add(jsonData['@position']);
                button.classList.add('floated');
            }
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
            button.classList.add(jsonData['@color']);
            button.className += ' labeled icon button';
            if (jsonData['@position']) {
                button.classList.add(jsonData['@position']);
                button.classList.add('floated');
            }
            button.textContent = jsonData['@buttonText'];
            button.appendChild(iTag);
            iTag.className = 'icon ';
            iTag.className += jsonData['@iconName'];
        } else if (jsonData['@buttonStyle'] === 'icon') {
            const iTag = document.createElement('i');
            button.className = `ui icon ${jsonData['@color']} ${jsonData['@size']} button`;
            if (jsonData['@position']) {
                button.classList.add(jsonData['@position']);
                button.classList.add('floated');
            }
            button.appendChild(iTag);
            iTag.className += 'icon ';
            iTag.className += (jsonData['@iconName'] || jsonData['@socialButton']);
        } else if (jsonData['@buttonStyle'] === 'circular') {
            const iTag = document.createElement('i');
            button.className = `ui icon ${jsonData['@size']} circular ${jsonData['@color']} button`;
            if (jsonData['@position']) {
                button.classList.add(jsonData['@position']);
                button.classList.add('floated');
            }
            button.appendChild(iTag);
            iTag.className = 'icon ';
            iTag.className += jsonData['@iconName'];
        } else if (jsonData['@buttonStyle'] === 'outline') {
            button.className = 'ui inverted ';
            if (jsonData['@size'].length > 1) {
                button.classList.add(jsonData['@size']);
            }
            if (jsonData['@position']) {
                button.classList.add(jsonData['@position']);
                button.classList.add('floated');
            }
            button.textContent = jsonData['@buttonText'];
            if (jsonData['@color']) {
                button.classList.add(jsonData['@color']);
                button.className += ' button';
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
            if (jsonData['@position']) {
                button.classList.add(jsonData['@position']);
                button.classList.add('floated');
            }
            button.prepend(iTag);
            iTag.className = jsonData['@socialButton'];
            iTag.classList.add('icon');
            button.classList.add('button');
        }

        buttonId.push(`#${id}`);
        button.setAttribute('id', id);
        $(button).click((e) => {
            e.preventDefault();
            console.log(node);
        });
        node.append(button);
    }
}
module.exports = Button;
