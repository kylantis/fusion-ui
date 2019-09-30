class PieChart extends BaseComponent {
    tagName() {
        return 'pieChart';
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
        let donutRadius;
        if (data['@donutChart'] && data['@3D'] === false) {
            donutRadius = data['@donutChartRadius'];
        }
        // Load the Visualization API and the corechart package.
        // eslint-disable-next-line no-undef
        google.charts.load('current', { packages: ['corechart'] });

        // Set a callback to run when the Google Visualization API is loaded.
        // eslint-disable-next-line no-undef
        google.charts.setOnLoadCallback(drawChart);

        // Callback that creates and populates a data table,
        // instantiates the pie chart, passes in the data and
        // draws it.
        function drawChart() {
            // Create the data table.
            // eslint-disable-next-line no-undef
            const info = new google.visualization.DataTable();
            info.addColumn(data['@subjectType'], data['@subject']);
            info.addColumn(data['@subjectValueType'], data['@subjectValue']);
            info.addRows(data['>']);

            // Set chart options
            const options = {
                title: data['@title'],
                width: 700,
                height: 500,
                backgroundColor: data['@backgroundColor'],
                is3D: data['@3D'],
                pieHole: donutRadius,
                pieSliceTextStyle: {
                    color: data['@textColor'],
                },
                slices: data['@slices'],
                animation: {
                    duration: 1400,
                    startup: true,
                    easing: 'in',
                },
            };

            // Instantiate and draw our chart, passing in some options.
            // eslint-disable-next-line no-undef
            const chart = new google.visualization.PieChart(document.getElementById(data['@id']));
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

module.exports = PieChart;
