
class Button extends BaseComponent {
    tagName() {
        return 'button';
    }

    componentId = this.getId();

    getCssDependencies() {
        switch (this.data['@buttonStyle']) {
        case 'basic' || '' || undefined:
            return (['/assets/css/button-basic.min.css', '/assets/css/icon.min.css']);
        case 'animated':
            return (['/assets/css/button-animated.min.css', '/assets/css/icon.min.css']);
        case 'labeled':
            return (['/assets/css/button-labeled.min.css', '/assets/css/icon.min.css']);
        case 'icon':
            return (['/assets/css/button-icon.min.css', '/assets/css/icon.min.css']);
        case 'disabled':
            return (['/assets/css/button-disabled.min.css', '/assets/css/icon.min.css']);
        case 'outline':
            return (['/assets/css/button-outline.min.css', '/assets/css/icon.min.css']);
        case 'circular':
            return (['/assets/css/button-circular.min.css', '/assets/css/icon.min.css']);
        case 'social':
            return (['/assets/css/button-social.min.css', '/assets/css/icon.min.css']);
        case 'attachd':
            return (['/assets/css/button-attached.min.css', '/assets/css/icon.min.css']);
        default:
            break;
        }
        return super.getCssDependencies().concat(['/assets/css/button.min.css', '/assets/css/icon.min.css']);
    }

    behaviorNames() {
        return ['click'];
    }

    invokeBehavior(behavior, data) {
        switch (behavior) {
        case 'click':
            data['@clientCallbacks']();
            this.triggerEvent('click', data, this.data);
            break;
        default:
            break;
        }
    }

    click(data) {
        this.invokeBehavior('click', data);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        const mainParent = document.createElement('kc-button');
        const button = document.createElement('button');
        mainParent.appendChild(button);
        const buttonId = [];

        if (jsonData['@buttonStyle'] === 'basic' || jsonData['@buttonStyle'].length === 0) {
            button.className = 'ui';
            button.className += ` ${jsonData['@color']}`;
            button.textContent = jsonData['@buttonText'];
            if (jsonData['@size']) {
                button.classList.add(`${jsonData['@size']}`);
            }
            if (jsonData['@inverted']) {
                button.classList.add('inverted');
            }
            if (jsonData['@position']) {
                button.classList.add(jsonData['@position']);
                button.classList.add('floated');
            }
            if (jsonData['@iconName']) {
                const iTag = document.createElement('i');
                iTag.className += ` ${jsonData['@iconPosition']} ${jsonData['@iconName']} icon`;
                button.prepend(iTag);
            }
            button.classList.add('button');
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
            if (jsonData['@inverted']) {
                button.classList.add('inverted');
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
            const buttonText = jsonData['@buttonText'];
            if (jsonData['@color']) {
                button.classList.add(jsonData['@color']);
                button.className += ' button';
            }
            const iTag = document.createElement('i');
            iTag.className = `${jsonData['@iconName']} icon`;
            button.appendChild(iTag);
            button.append(buttonText);
        } else if (jsonData['@buttonStyle'] === 'disabled') {
            button.className = `ui disabled ${jsonData['@size']} ${jsonData['@color']} button`;
            const iTag = document.createElement('i');
            const buttonText = jsonData['@buttonText'];
            button.appendChild(iTag);
            iTag.className = `${jsonData['@iconName']} icon`;
            button.append(buttonText);
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
        } else if (jsonData['@buttonStyle'] === 'attached') {
            mainParent.removeChild(button);
            const children = jsonData['>'];
            const groupButtons = document.createElement('div');
            const arrayOfNums = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve '];
            groupButtons.className = `ui ${arrayOfNums[children.length]}fluid buttons`;
            mainParent.append(groupButtons);
            console.log(mainParent);
            children.forEach((child) => {
                const attbutton = document.createElement('button');
                attbutton.className = 'ui button';
                attbutton.textContent = child['@buttonText'];
                if (jsonData['@inverted']) {
                    attbutton.classList.add('inverted');
                }
                if (child['@color'] !== undefined && child['@color'] !== null) {
                    attbutton.classList.add(`${child['@color']}`);
                }
                if (child['@size'] !== undefined && child['@size'] !== null) {
                    attbutton.classList.add(`${child['@size']}`);
                }
                attbutton.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.click(child);
                });
                groupButtons.append(attbutton);
            });
            node.append(mainParent);
            return;
        }
        if (jsonData['@fluid']) {
            button.classList.add('fluid');
        }
        if (jsonData['@rounded']) {
            button.style.borderRadius = '10rem';
        }
        button.setAttribute('id', this.getComponentId());
        buttonId.push(button.getAttribute('id'));
        $(button).click((e) => {
            e.preventDefault();
            this.click(this.data);
        });
        node.append(mainParent);
        this.isRendered(this.getComponentId());
    }
}
module.exports = Button;
