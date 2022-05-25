class LightningComponent extends BaseComponent {

    initCompile() {
    }

    jsDependencies() {
        return [
            ...super.jsDependencies(),
            // Todo: Add extra js files to be used across all components
        ];
    }

    cssDependencies() {
        return [
            ...super.cssDependencies(),
            '/assets/styles/base.min.css',
            '/assets/styles/salesforce-lightning-design-system.min.css',
            ... this.isMobile() ? ['/assets/styles/salesforce-lightning-design-system_touch.min.css'] : [],
            // Todo: Add extra css files to be used across all components
        ];
    }

    static isAbstract() {
        return true;
    }

    behaviours() {
        return ['showTooltip'];
    }

    showTooltip() {

    }

    getLoader() {
        return `
            <div style='position: absolute; display: table; width: 100%; height: 100%;'>
              <div style='vertical-align: middle; display: table-cell;'>
                <img width='20px' src='/assets/images/loader.gif' style='display: block; margin-left: auto; margin-right: auto;'>
              </div>
            </div>
        `;
    }

    isMobile() {
        return navigator.userAgent.match(/Android/i)
            || navigator.userAgent.match(/webOS/i)
            || navigator.userAgent.match(/iPhone/i)
            || navigator.userAgent.match(/iPad/i)
            || navigator.userAgent.match(/iPod/i)
            || navigator.userAgent.match(/BlackBerry/i)
            || navigator.userAgent.match(/Windows Phone/i)
    }

    hasInputProperty(component, propertyName) {
        assert(component instanceof BaseComponent);
        assert(typeof propertyName == 'string');

        return component.getInput()[propertyName] != undefined;
    }

}

module.exports = LightningComponent;