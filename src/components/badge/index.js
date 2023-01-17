
class Badge extends components.LightningComponent {

    getGlobalVariables() {
        return {
            ...super.getGlobalVariables(),
            nonInverseColors: ['default', 'shade', 'alert-texture'],
        }
    }

    getGlobalVariableTypes() {
        const { arrayType } = BaseComponent.CONSTANTS;
        return {
            ...super.getGlobalVariableTypes(),
            nonInverseColors: arrayType,
        }
    }
}
module.exports = Badge;