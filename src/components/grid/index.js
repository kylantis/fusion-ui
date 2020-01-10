
class Grid extends BaseComponent {
    tagName() {
        return 'grid';
    }

    static numberOfComponents = 0;

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/dimmer.min.css', '/assets/css/grid.min.css', '/assets/css/segment.min.css', '/assets/css/custom-grid.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/dropdown.min.js', '/assets/js/dimmer.min.js']);
    }

    addDimmer() {
        const elem = document.querySelector('body');
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui anypage dimmer';
        const spinnerDiv = this.appendNode(uiDiv, 'div', uiDiv);
        BaseComponent.getComponent('spinner', { '@id': 'dimmerSpinner', '@spinnerType': 'foldingCube' }, spinnerDiv);
        elem.append(uiDiv);
        // $('.anypage').dimmer('show');
        $('.anypage').dimmer({
            duration: {
                show: 1000,
                hide: 1500,
            },
        });
    }

    getRenderedComponents() {
        // eslint-disable-next-line no-use-before-define
        const observer = new MutationObserver(callback);
        const number = Grid.numberOfComponents;
        function callback(mutations) {
            if (mutations.length >= number) {
                // $('#inCardSpinner').remove();
                $('.anypage').dimmer('hide');
            }
        }

        const body = document.querySelector('body');

        const config = {
            childList: true,
        };

        observer.observe(body, config);
    }

    render() {
        const { node } = this;
        const { data } = this;
        this.addDimmer();

        function createNewRow(parent) {
            const div = document.createElement('div');
            div.className = 'row';
            parent.appendChild(div);
            return div;
        }

        function createStretchedRow(parent) {
            const div = document.createElement('div');
            div.className = 'stretched row';
            parent.appendChild(div);
            return div;
        }

        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui grid';
        if (data['@equalWidth']) {
            uiDiv.className += ' equal width';
        }
        if (data['@stackable']) {
            uiDiv.className += ' stackable';
        }
        if (data['@numberOfColumns']) {
            uiDiv.className += ` ${data['@numberOfColumns']} column`;
        }

        const firstParents = this.data['>'];
        firstParents.forEach((element) => {
            if (element['@tag'] === 'row') {
                // eslint-disable-next-line no-use-before-define
                traverse(element['>'], createNewRow(uiDiv));
            }
            if (element['@tag'] === 'stretchedRow') {
                // eslint-disable-next-line no-use-before-define
                traverseStretchedRow(element['>'], createStretchedRow(uiDiv));
            }
        });

        function traverseStretchedRow(info, parent) {
            if (info !== undefined || info !== null) {
                info.forEach((element) => {
                    if (element['@tag'] === 'column') {
                        const columnDiv = document.createElement('div');
                        columnDiv.className = 'column';
                        if (element['>'] !== undefined || element['>'] !== null) {
                            const newElements = element['>'];
                            newElements.forEach((newElement) => {
                                if (newElement['@tag'] === 'segment') {
                                    const segmentDiv = document.createElement('div');
                                    segmentDiv.className = 'ui segment';
                                    segmentDiv.id = newElement['@columnId'];
                                    if (newElement['@columnWidth']) {
                                        segmentDiv.classList.add(newElement['@columnWidth']);
                                    }
                                    columnDiv.appendChild(segmentDiv);
                                    BaseComponent.getComponent(newElement['@tagName'], newElement['@tagData'], segmentDiv);
                                    parent.appendChild(columnDiv);
                                }
                            });
                        }
                    }
                });
            }
        }

        function traverse(somedata, parent) {
            if (somedata !== undefined || somedata !== null) {
                somedata.forEach((element) => {
                    const div = document.createElement('div');
                    if (element['@tag'] === 'row') {
                        div.className = 'column';
                        const rowDiv = document.createElement('div');
                        rowDiv.className = 'row';
                        div.appendChild(rowDiv);
                        parent.appendChild(div);
                        if (element['>'] !== undefined || element['>'] !== null) {
                            traverse(element['>'], rowDiv);
                        }
                    }
                    if (element['@tag'] === 'column') {
                        Grid.numberOfComponents += 1;
                        div.className = 'column';
                        div.id = element['@columnId'];
                        if (element['@columnWidth']) {
                            div.classList.add(element['@columnWidth']);
                        }
                        if (element['@centered']) {
                            div.classList.add('centerGrid');
                        }
                        if (element['@segment'] === 'segmented') {
                            const segment = document.createElement('div');
                            segment.className = 'segment';
                            div.appendChild(segment);
                            const comp = BaseComponent.getComponent(element['@tagName'], element['@tagData'], segment);
                            comp.then((blob) => {
                                const props = Object.getPrototypeOf(blob);
                                console.log(props.getCssDependencies());
                            }); // TODO find a way to make sure CSS files loaded by getComponent loads once
                            parent.appendChild(div);
                            return;
                        }
                        const comp = BaseComponent.getComponent(element['@tagName'], element['@tagData'], div);
                        comp.then((blob) => {
                            const props = Object.getPrototypeOf(blob);
                            console.log(props);
                        });
                        parent.appendChild(div);
                    }
                });
            }
        }
        node.append(uiDiv);
        this.getRenderedComponents();
    }
}
module.exports = Grid;
