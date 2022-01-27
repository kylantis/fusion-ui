/**
 * Add component overrides here, as all component classes extend this class
 */
class AbstractComponent extends BaseComponent {

    jsDependencies() {
        return [
            ...super.jsDependencies(),
            // Todo: Add extra js files to be used across all components
        ];
    }

    cssDependencies() {
        return [
            ...super.cssDependencies(),
            '/assets/styles/salesforce-lightning-design-system.min.css',
            ... this.isMobile() ? ['/assets/styles/salesforce-lightning-design-system_touch.min.css'] : [],
            '/assets/styles/base.min.css',
            // Todo: Add extra css files to be used across all components
        ];
    }

    getLoader() {
        return `
            <div style='display: table; width: 100%; height: 100%;'>
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
}
module.exports = AbstractComponent;