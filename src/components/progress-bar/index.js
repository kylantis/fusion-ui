
class ProgressBar extends components.LightningComponent {

    initializers() {
        return {
            ['min']: 0,
            ['max']: 100,
            ['radius']: true
        }
    }
    
}
module.exports = ProgressBar;