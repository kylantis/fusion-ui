class Carousel extends BaseComponent {
    tagName() {
        return 'carousel';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/carousel.min.css', '/assets/css/custom-carousel.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/carousel.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const { data } = this;
        const carouselDiv = document.createElement('ul');
        carouselDiv.id = data['@id'];
        carouselDiv.className = 'gallery';
        if (data['>']) {
            data['>'].forEach((element) => {
                const el = this.appendNode(carouselDiv, 'li', null);
                el.setAttribute('data-thumb', element['@imageSrc']);
                const aTag = this.appendNode(el, 'a', null);
                aTag.href = element['@imageLink'];
                const imgTag = this.appendNode(aTag, 'img', null);
                imgTag.src = element['@imageSrc'];
                const captionDiv = this.appendNode(el, 'div', 'caption');
                const caption = this.appendNode(captionDiv, 'p', null);
                caption.textContent = element['@captionText'];
            });
        }
        node.append(carouselDiv);
        $(`#${this.getComponentId()}`).lightSlider({
            item: data['@imagesInView'],
            loop: data['@loop'],
            controls: data['@control'],
            gallery: data['@gallery'],
            mode: data['@mode'],
            easing: data['@easing'],
            speed: data['@speed'],
            pause: data['@pause'],
            minSlide: 1,
            maxSlide: 1,
            auto: true,
        });
        if (!this.data['@showCaption']) {
            $(`#${this.getComponentId()} div.caption`).remove();
        }
    }
}

module.exports = Carousel;
