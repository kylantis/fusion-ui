
class Icon extends components.AbstractComponent {

    toIconClassName(name) {
        return name.replaceAll('_', '-');
    }
}
module.exports = Icon;