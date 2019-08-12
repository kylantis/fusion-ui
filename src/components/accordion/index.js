
class Accordion extends BaseComponent {
    tagName() {
        return 'accordion';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/accordion.min.css',
            '/assets/css/dropdown.min.css', '/assets/css/transition.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/accordion.min.js',
            '/assets/js/dropdown.min.js', '/assets/js/transition.min.js']);
    }

    behaviorNames() {
        return ['addContent', 'deleteContent', 'editContent'];
    }

    static getAccordionId(event) {
        return event.target.id;
    }

    getAccordionNode() {
        return this.node.firstChild;
    }

    getComponentId() {
        return this.#componentId;
    }

    addContents(data, parentNode) {
        for (let i = 0; i < data.length; i += 1) {
            const id = `accordion-${this.getRandomInt()}`;
            for (const [key, value] of Object.entries(data[i])) {
                if (key === '@title') {
                    const titleDiv = document.createElement('div');
                    this.appendNode(titleDiv, 'i', 'dropdown icon');
                    titleDiv.className = 'title';
                    titleDiv.setAttribute('id', `${id}-title`);
                    parentNode.appendChild(titleDiv);
                    const textSpan = document.createElement('span');
                    textSpan.innerHTML = value;
                    titleDiv.appendChild(textSpan);
                }
                if (key === '@content') {
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'content';
                    contentDiv.setAttribute('id', `${id}-content`);
                    parentNode.appendChild(contentDiv);
                    const ptag = document.createElement('p');
                    contentDiv.appendChild(ptag);
                    ptag.className = 'transition hidden';
                    ptag.textContent = value;
                }
            }
        }
    }

    invokeBehavior(behavior, data) {
        const element = document.getElementById(data.id);
        let contentDiv = 0;
        const newTitle = data.title;
        const newContent = data.content;

        switch (behavior) {
        case 'addContent':
            this.addContents(data['>'], this.getAccordionNode());
            break;

        case 'deleteContent':
            contentDiv = element.nextSibling;
            element.parentNode.removeChild(element);
            contentDiv.parentNode.removeChild(contentDiv);
            break;

        case 'editContent':
            contentDiv = element.nextSibling;
            if (data.title && element.id.includes('title')) {
                element.lastChild.innerHTML = newTitle;
            }

            if (data.content && contentDiv.id.includes('content')) {
                contentDiv.firstChild.innerHTML = newContent;
            }
            break;

        default:

            break;
        }
    }

    addContent(data) {
        this.invokeBehavior('addContent', data);
    }

    deleteContent(data) {
        this.invokeBehavior('deleteContent', data);
    }

    editContent(data) {
        this.invokeBehavior('editContent', data);
    }

    render() {
        const { node } = this;
        const accordionId = [];

        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui fluid';

        if (this.data['@displayStyle'] === 'styled') {
            uiDiv.classList.add('styled');
        }

        if (this.data['>']) {
            const accData = this.data['>'];
            // addContents function
            this.addContents(accData, uiDiv);
            uiDiv.setAttribute('id', this.getComponentId());
            accordionId.push(`#${uiDiv.getAttribute('id')}`);
            uiDiv.classList.add('accordion');
            node.append(uiDiv);
            $('.ui.accordion').accordion();
        }
    }
}

module.exports = Accordion;
