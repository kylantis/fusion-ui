class Item extends BaseComponent {
    tagName() {
        return 'item';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/item.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }


    render() {
        const { node } = this;
        const uiDiv = document.createElement('div');

        node.append(uiDiv);
    }
}

module.exports = Item;
