
class Alert extends components.LightningComponent {

    events() {
        return ['close'];
    }

    onCloseIconClick() {
        this.dispatchEvent('close');
    }

}
module.exports = Alert;