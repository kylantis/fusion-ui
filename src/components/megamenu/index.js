class MegaMenu extends BaseComponent {
    tagName() {
        return 'megamenu';
    }

    componentId = this.getId();

    getCssDependencies() {
        return (['/assets/css/megamenu.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/megamenu.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    generateMMChildren(parent, data) {
        const childUlHead = this.appendNode(parent, 'ul', 'dropdown');
        let liTag;
        data.forEach((element) => {
            if (element['@tag'] === 'subMenuHeading') {
                liTag = this.appendNode(childUlHead, 'li', 'has-children has-dropdown');
                const aTag = this.appendNode(liTag, 'a', null);
                aTag.href = element['@link'];
                aTag.textContent = element['@title'];
            }
            const childUl = this.appendNode(liTag, 'ul', 'dropdown');
            element['>'].forEach((el) => {
                const childLiTag = this.appendNode(childUl, 'li', null);
                const aTag = this.appendNode(childLiTag, 'a', null);
                aTag.href = el['@link'];
                aTag.textContent = el['@title'];
            });
        });
    }

    render() {
        const { node } = this;
        const { data } = this;

        const headerDiv = document.createElement('header');
        headerDiv.id = 'top';
        headerDiv.className = 'wide-layout';
        const headerwrap = this.appendNode(headerDiv, 'div', null);
        headerwrap.id = 'header-wrapper';
        const container = this.appendNode(headerwrap, 'div', 'container');
        const nav = this.appendNode(container, 'nav', 'top-bar');
        nav.setAttribute('style', 'height: 100px;');
        const titleUl = this.appendNode(nav, 'ul', 'title-area');
        const liName = this.appendNode(titleUl, 'li', 'name');
        const titleATag = this.appendNode(liName, 'a', null);
        titleATag.href = '';
        titleATag.rel = 'home';
        // eslint-disable-next-line no-unused-vars
        const titleImg = this.appendNode(titleATag, 'img', null);
        titleImg.src = data['@imgSrc'];
        titleImg.setAttribute('style', 'position: absolute; top: 0px; left: 0px; height: 50px; width: 150px; margin-top: 24.5px; margin-bottom: 24.5px; display: inline-block;');
        const topBar = this.appendNode(titleUl, 'li', 'toggle-topbar');
        const topBarATag = this.appendNode(topBar, 'a', 'left-off-canvas-toggle');
        topBarATag.href = data['@homeURL'];
        topBarATag.textContent = data['@menuTitle'];
        const sectionDiv = document.createElement('section');
        nav.appendChild(sectionDiv);
        sectionDiv.className = 'top-bar-section';
        const menuUl = document.createElement('ul');
        sectionDiv.appendChild(menuUl);
        menuUl.id = 'menu-main-menu-1';
        menuUl.classList.add('right');
        if (data['>']) {
            data['>'].forEach((element) => {
                const parentLiTag = document.createElement('li');
                const aTag = this.appendNode(parentLiTag, 'a', null);
                aTag.href = element['@link'];
                aTag.textContent = element['@title'];
                menuUl.appendChild(parentLiTag);
                $(parentLiTag).hover(() => {
                    $(parentLiTag).toggleClass('hippo-menu-hovered');
                });
                if (element['@megaMenu']) {
                    parentLiTag.classList.add('megamenu');
                    if (element['>']) {
                        parentLiTag.classList.add('has-dropdown');
                        this.generateMMChildren(parentLiTag, element['>']);
                    }
                }
            });
        }
        node.append(headerDiv);
        (jQuery)('.top-bar-section').megamenu(1200);
    }
}

module.exports = MegaMenu;
