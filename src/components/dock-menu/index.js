class DockMenu extends BaseComponent {
    tagName() {
        return 'dockmenu';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/dock-menu.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/dock-jquery.min.js', '/assets/js/interface.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const { data } = this;

        const dockDiv = document.createElement('div');
        dockDiv.className = 'dock';
        dockDiv.id = 'dock2';
        const dockContainer = this.appendNode(dockDiv, 'div', 'dock-container2');
        dockDiv.appendChild(dockContainer);
        // if (data['>']) {
        //     data['>'].forEach((menu) => {
        //         const a = document.createElement('a');
        //         a.className = 'dock-item2';
        //         a.href = menu['@imgLink'];
        //         const span = this.appendNode(a, 'span', null);
        //         span.textContent = menu['@title'];
        //         const img = this.appendNode(a, 'img', null);
        //         img.src = menu['@imgSrc'];
        //         dockContainer.appendChild(a);
        //     });
        // }
        node.append(dockDiv);
        $(document).ready(
            () => {
                $('#dock2').Fisheye(
                    {
                        maxWidth: 60,
                        items: 'a',
                        itemsText: 'span',
                        container: '.dock-container2',
                        itemWidth: 40,
                        proximity: 80,
                        alignment: 'left',
                        valign: 'bottom',
                        halign: 'center',
                    },
                );
            },
        );
    }
}

module.exports = DockMenu;
