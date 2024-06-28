
class TextCompanion extends components.LightningComponent {
    static isAbstract() {
        return true;
    }

    static getMarginSizesInRem() {
        return {
            ['xx-small']: .25,
            ['x-small']: .5,
            ['small']: .75,
            ['medium']: 1,
            ['large']: 1.5,
            ['x-large']: 2,
            ['xx-large']: 3,
        }
    }
}

module.exports = TextCompanion;