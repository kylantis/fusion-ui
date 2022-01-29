class Icon extends AbstractComponent {

    toIconClassName(name) {
        return name.replaceAll('_', '-');
    }
}
module.exports = Icon;