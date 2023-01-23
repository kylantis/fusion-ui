
const AxisChart = require('./index');
const frappe = require('frappe-charts');

class AxisChartTest extends AxisChart {

    initCompile() {
        global.frappe = frappe;
    }
}

module.exports = AxisChartTest;