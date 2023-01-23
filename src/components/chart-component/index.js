
/**
 * Charts is powered by https://frappe.io/
 */
class ChartComponent extends components.LightningComponent {

    jsDependencies() {
        return [
            ...super.jsDependencies(),
            {
                // 'https://cdn.jsdelivr.net/npm/frappe-charts@1/dist/frappe-charts.min.cjs.min.js'
                url: '/assets/js/cdn/frappe-charts.min.js',
                namespace: 'frappe'
            }
        ];
    }

    static isAbstract() {
        return true;
    }

    onMount() {
       
    }

    /**
     * Charts use a third-party library so there's no need to attempt to load them after 
     * compile - which is mostly for test purposes. Moreover, even if we wanted to - Frappe 
     * does not have a way to callback after chart has been fully rendered
     */
    loadAfterCompile() {
        return false;
    }
}
module.exports = ChartComponent;