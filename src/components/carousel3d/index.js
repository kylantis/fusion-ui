class Carousel3D extends BaseComponent {
    tagName() {
        return 'carousel3D';
    }

    componentId = this.getId();

    getCssDependencies() {
        return (['/assets/css/carousel3d.min.css']);
    }

    getJsDependencies() {
        return (['https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js', '/assets/js/carousel3d.min.js']);
        // return super.getJsDependencies().concat(['/assets/js/carousel3d.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const kcWrap = document.createElement('div');
        kcWrap.className = 'kc-wrap';
        node.append(kcWrap);
        const kcHorizon = this.appendNode(kcWrap, 'div', 'kc-horizon');
        const bShadow = '/assets/images/3dcarousel/shadow-bottom.png';
        const lShadow = '/assets/images/3dcarousel/shadow-left.png';
        const rShadow = '/assets/images/3dcarousel/shadow-right.png';
        this.data['>'].forEach((el) => {
            const imgContainer = this.appendNode(kcHorizon, 'div', 'kc-item');
            if (el['@frontImage']) {
                imgContainer.classList.add('kc-front-item');
            }
            const mainImage = this.appendNode(imgContainer, 'img', null);
            mainImage.src = el['@imageSrc'];
            const bottomShadow = this.appendNode(imgContainer, 'img', 'cc-decoration kc-shadow-bottom');
            bottomShadow.src = bShadow;
            bottomShadow.setAttribute('style', 'background-image: none;');
            const leftShadow = this.appendNode(imgContainer, 'img', 'cc-decoration kc-shadow-left');
            leftShadow.src = lShadow;
            leftShadow.setAttribute('style', 'background-image: none;');
            const rightShadow = this.appendNode(imgContainer, 'img', 'cc-decoration kc-shadow-right');
            rightShadow.src = rShadow;
            rightShadow.setAttribute('style', 'background-image: none;');
        });
    }
}

module.exports = Carousel3D;
