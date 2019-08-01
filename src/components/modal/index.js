class Modal extends BaseComponent {
    tagName() {
        return 'modal';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/modal.min.css', '/assets/css/icon.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/css/modal.min.js']);
    }

    render() {

    }
}
module.exports = Modal;
