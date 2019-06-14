
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

    render() {
        const { node } = this;

        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui fluid';

        if (this.data['@displayStyle'] === 'styled') {
            uiDiv.classList.add('styled');
        }

        if (this.data['>']) {
            for (let i = 0; i < this.data['>'].length; i++) {
                for (const [key, value] of Object.entries(this.data['>'][i])) {
                    if (key === '@title') {
                        const titleDiv = document.createElement('div');
                        // let iTag = document.createElement('i');
                        this.appendNode(titleDiv, 'i', 'dropdown icon');
                        // titleDiv.prepend(iTag);
                        // iTag.className = "dropdown icon";
                        titleDiv.className = 'title';
                        uiDiv.appendChild(titleDiv);
                        const textnode = document.createTextNode(value);
                        titleDiv.appendChild(textnode);
                    }
                    if (key === '@content') {
                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'content';
                        uiDiv.appendChild(contentDiv);
                        const ptag = document.createElement('p');
                        contentDiv.appendChild(ptag);
                        ptag.className = 'transition hidden';
                        ptag.textContent = value;
                    }
                }
            }
            uiDiv.classList.add('accordion');
            node.append(uiDiv);
            $('.ui.accordion').accordion();
        }
    }
}
