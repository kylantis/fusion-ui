class OrgChart extends BaseComponent {
    tagName() {
        return 'orgChart';
    }

    componentId = this.getId();

    getJsDependencies() {
        return (['https://www.gstatic.com/charts/loader.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    initChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['orgchart'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = new google.visualization.DataTable();
            info.addColumn('string', 'Name');
            info.addColumn('string', 'Manager');
            info.addColumn('string', 'ToolTip');

            // For each orgchart box, provide the name, manager, and tooltip to show.
            info.addRows(data['>']);

            const options = {
                allowHtml: true,
                color: data['@color'],
                size: data['@size'],
                allowCollapse: data['@allowCollapse'],
            };

            // Create the chart.
            const chart = new google.visualization.OrgChart(document.getElementById(data['@id']));
            // Draw the chart, setting the allowHtml option to true for the tooltips.
            chart.draw(info, options);
        }
    }

    render() {
        const { node } = this;

        const chartDiv = document.createElement('div');
        chartDiv.id = this.data['@id'];
        node.append(chartDiv);

        this.initChart();
    }
}

module.exports = OrgChart;
