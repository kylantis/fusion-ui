
class Rating extends BaseComponent {
    tagName() {
        return 'rating';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/rating.min.css', '/assets/css/icon.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/rating.min.js']);
    }

    getRatingId(event) {
        return event.target.parentNode.id;
    }

    getComponentId() {
        return this.componentId;
    }

    getRating(e) {
        const value = document.getElementById(this.getRatingId(e));
        const rating = value.querySelectorAll('.active').length;
        return rating;
    }

    render() {
        const { node } = this;
        const mainParent = document.createElement('kc-rating');
        const uiDiv = document.createElement('div');
        uiDiv.setAttribute('id', this.getComponentId());
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
        $(uiDiv).click('submit', (e) => {
            this.getRating(e);
        });
        mainParent.appendChild(uiDiv);
        node.append(mainParent);

        $('.ui.rating')
            .rating({
                initialRating: this.data['@data-rating'],
                maxRating: this.data['@data-max-rating'],
            });
        this.isRendered(this.getComponentId());
    }
}
module.exports = Rating;
