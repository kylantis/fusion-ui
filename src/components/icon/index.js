class Icon extends BaseComponent {

    toIconClassName(name) {
        return name.replaceAll('_', '-');
    }

}
module.exports = Icon;