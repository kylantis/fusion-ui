
class Rating extends BaseComponent {
    tagName() {
        return 'rating';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/rating.min.css', '/assets/css/icon.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/rating.min.js']);
    }

    getId(event) {
        return event.target.parentNode.id;
    }

    getRating(e) {
        const value = document.getElementById(this.getId(e));
        const rating = value.querySelectorAll('.active').length;
        return rating;
    }

    render() {
        const { node } = this;
        const uiDiv = document.createElement('div');
        let id;
        if (this.data['@id']) {
            id = this.data['@id'];
        } else {
            id = `${node.getAttribute('id')}-${this.getRandomInt()}`;
        }
        uiDiv.setAttribute('id', id);
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
        node.append(uiDiv);

        $('.ui.rating')
            .rating({
                initialRating: this.data['@data-rating'],
                maxRating: this.data['@data-max-rating'],
            });
    }
}
module.exports = Rating;
