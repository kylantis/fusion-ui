class Carousel extends BaseComponent {
    tagName() {
        return 'carousel';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/carousel.min.css', '/assets/css/custom-carousel.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/carousel.min.js']);
    }

    getComponentId() {
        return this.#componentId;
    }

    render() {
        const { node } = this;
        const { data } = this;
        const carouselDiv = document.createElement('ul');
        carouselDiv.id = 'lightSlider';
        carouselDiv.className = 'gallery';
        if (data['>']) {
            data['>'].forEach((element) => {
                const el = this.appendNode(carouselDiv, 'li', null);
                el.setAttribute('data-thumb', element['@imageSrc']);
                const aTag = this.appendNode(el, 'a', null);
                aTag.href = element['@imageHref'];
                const imgTag = this.appendNode(aTag, 'img', null);
                imgTag.src = element['@imageSrc'];
            });
        }
        node.append(carouselDiv);
        $('#lightSlider').lightSlider({
            item: 1,
            loop: true,
            controls: true,
            gallery: true,
            minSlide: 1,
            maxSlide: 1,
            auto: true,
        });
    }
}

module.exports = Carousel;
