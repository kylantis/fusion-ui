
class Icon extends components.LightningComponent {

    toIconClassName(name) {
        return name.replaceAll('_', '-');
    }
}
module.exports = Icon;