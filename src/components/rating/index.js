
class Rating extends BaseComponent {
    tagName() {
        return 'rating';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/assets/css/rating.min.css', '/assets/css/icon.min.css');
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies();
        baseDependencies.push('/assets/js/rating.min.js');
        return baseDependencies;
    }

    render() {
        const { node } = this;

        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui';

        if (this.data['@displayStyle'].length > 0) {
            uiDiv.classList.add(this.data['@displayStyle']);
        }

        if (this.data['@size'].length > 0) {
            uiDiv.classList.add(this.data['@size']);
        }

        uiDiv.setAttribute('data-rating', this.data['@data-rating']);
        uiDiv.setAttribute('data-max-rating', this.data['@data-max-rating']);

        uiDiv.classList.add('rating');
        node.append(uiDiv);

        $('.ui.rating')
            .rating({
                initialRating: this.data['@data-rating'],
                maxRating: this.data['@data-max-rating'],
            });
    }
}
module.exports = Rating;
