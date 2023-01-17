
/**
 * Charts is powered by 
 */
class ChartComponent extends components.LightningComponent {

    jsDependencies() {
        return [
            ...super.jsDependencies(),
            // 'https://cdn.jsdelivr.net/npm/frappe-charts@1/dist/frappe-charts.min.cjs.min.js'
            '/assets/js/cdn/frappe-charts.min.js',
        ];
    }

    static isAbstract() {
        return true;
    }
}
module.exports = ChartComponent;