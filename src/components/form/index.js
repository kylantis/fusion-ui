class Form extends BaseComponent {
    tagName() {
        return 'form';
    }

    behaviorNames() {
        return ['submit', 'validate', 'populateForm'];
    }
}
module.exports = Form;
