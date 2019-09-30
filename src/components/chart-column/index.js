class ColumnChart extends BaseComponent {
    tagName() {
        return 'columnChart';
    }

    componentId = this.getId();

    getJsDependencies() {
        return (['https://www.gstatic.com/charts/loader.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    initSingleMaterialChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['bar'] });
        google.charts.setOnLoadCallback(drawStuff);

        function drawStuff() {
            const info = new google.visualization.arrayToDataTable(data['>']);

            const options = {
                height: data['@height'],
                width: data['@width'],
                legend: { position: data['@legendPosition'] },
                chart: {
                    title: data['@title'],
                    subtitle: data['@subtitle'],
                },
                forceIFrame: data['@forceIFrame'],
                axes: {
                    x: {
                        0: { side: 'bottom', label: data['@hAxisTitle'] },
                    },
                    y: {
                        0: { label: data['@vAxisTitle'] },
                    },
                },
                bar: { groupWidth: `${data['@barWidth']}%` },
            };

            const chart = new google.charts.Bar(document.getElementById(data['@id']));
            // Convert the Classic options to Material options.
            chart.draw(info, google.charts.Bar.convertOptions(options));
        }
    }

    initMultipleMaterialChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['bar'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                chart: {
                    title: data['@title'],
                    subtitle: data['@subtitle'],
                },
                forceIFrame: data['@forceIFrame'],
            };

            const chart = new google.charts.Bar(document.getElementById(data['@id']));

            chart.draw(info, google.charts.Bar.convertOptions(options));
        }
    }

    // Single Classic Bar Chart
    initSingleBarChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['corechart'] });
        google.charts.setOnLoadCallback(drawChart);
        function drawChart() {
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                title: data['@title'],
                width: data['@width'],
                height: data['@height'],
                bar: { groupWidth: data['@barWidth'] },
                backgroundColor: {
                    fill: data['@backgroundColor'],
                },
                forceIFrame: data['@forceIFrame'],
                legend: { position: data['@legendPosition'], maxLines: 3 },
                isStacked: data['@stacked'],
                hAxis: {
                    title: data['@hAxis']['@title'],
                    maxValue: data['@hAxis']['@maxValue'],
                    minValue: data['@hAxis']['@minValue'],
                },
                vAxis: {
                    title: data['@vAxis']['@title'],
                    maxValue: data['@vAxis']['@maxValue'],
                    minValue: data['@vAxis']['@minValue'],
                },
                animation: {
                    startup: true,
                    duration: 2000,
                    easing: 'linear',
                },
            };
            const chart = new google.visualization.ColumnChart(document.getElementById(data['@id']));
            chart.draw(info, options);
        }
    }

    initMultipleBarChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['corechart'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                chart: {
                    title: data['@title'],
                    subtitle: data['@subtitle'],
                },
                forceIFrame: data['@forceIFrame'],
            };

            const chart = new google.charts.Bar(document.getElementById(data['@id']));
            chart.draw(info, options);
        }
    }

    render() {
        const { node } = this;

        const chartDiv = document.createElement('div');
        chartDiv.id = this.data['@id'];
        chartDiv.setAttribute('style', 'width: 900px; height: 500px;');
        node.append(chartDiv);

        switch (this.data['@type']) {
        case 'classic-single chart':
            this.initSingleBarChart();
            break;
        case 'classic-multiple chart':
            this.initMultipleBarChart();
            break;
        case 'material-single chart':
            this.initSingleMaterialChart();
            break;
        case 'material-multiple chart':
            this.initMultipleMaterialChart();
            break;
        default:
            break;
        }
    }
}

module.exports = ColumnChart;
