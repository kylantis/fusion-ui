
// eslint-disable-next-line no-unused-vars
class Accordion extends BaseComponent {
    tagName() {
        return 'accordion';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/assets/css/accordion.min.css', '/assets/css/dropdown.min.css', '/assets/css/transition.min.css');
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies();
        baseDependencies.push('/assets/js/accordion.min.js', '/assets/js/dropdown.min.js', '/assets/js/transition.min.js');
        return baseDependencies;
    }

    static getAccordionId(event) {
        const accordionTitle = event.target.id;
        if (accordionTitle.includes('title')) {
            const accordionContent = $(`#${accordionTitle}`).next()[0].id;
            console.log(accordionTitle);
            console.log(accordionContent);
        }
    }

    getAccordionNode() {
        return this.node.firstChild;
    }

    addContents(parentNode, data) {
        for (let i = 0; i < data.length; i += 1) {
            const id = `accordion-${this.getRandomInt()}`;
            for (const [key, value] of Object.entries(data[i])) {
                if (key === '@title') {
                    const titleDiv = document.createElement('div');
                    this.appendNode(titleDiv, 'i', 'dropdown icon');
                    titleDiv.className = 'title';
                    titleDiv.setAttribute('id', `${id}-title`);
                    parentNode.appendChild(titleDiv);
                    const textnode = document.createTextNode(value);
                    titleDiv.appendChild(textnode);
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

    update(behavior, data) {
        const element = document.getElementById(data);

        switch (behavior) {
        case 'addContent':
            this.addContents(this.getAccordionNode(), data['>']);

            break;

        case 'deleteContent':
            element.parentNode.remove(element);
            break;

        case 'editContent':

            break;

        default:

            break;
        }
    }

    render() {
        const { node } = this;
        const accordionId = [];

        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui fluid';
        uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);

        if (this.data['@displayStyle'] === 'styled') {
            uiDiv.classList.add('styled');
        }

        if (this.data['>']) {
            const accData = this.data['>'];
            // addContents function
            this.addContents(uiDiv, accData);
            const id = `${uiDiv.getAttribute('id')}-${this.getRandomInt()}`;
            accordionId.push(`#${id}`);
            uiDiv.setAttribute('id', id);
            uiDiv.classList.add('accordion');
            node.append(uiDiv);
            $('.ui.accordion').accordion();
        }
    }
}
