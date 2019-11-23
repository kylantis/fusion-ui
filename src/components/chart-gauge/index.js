class GaugeChart extends BaseComponent {
    tagName() {
        return 'gaugeChart';
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

        google.charts.load('current', { packages: ['gauge'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                height: data['@chartHeight'],
                width: data['@chartWidth'],
                redFrom: data['@redFrom'],
                redTo: data['@redTo'],
                yellowFrom: data['@yellowFrom'],
                yellowTo: data['@yellowTo'],
                greenFrom: data['@greenFrom'],
                greenTo: data['@greenTo'],
                minorTicks: data['@minorTicks'],
                majorTicks: data['@majorTicks'],
                max: data['@gaugeMax'],
                min: data['@gaugeMin'],
                forceIFrame: data['@forceIFrame'],
                animation: {
                    duration: 500,
                    easing: 'linear',
                },
            };
            const chart = new google.visualization.Gauge(document.getElementById(data['@id']));
            chart.draw(info, options);

            setInterval(() => {
                info.setValue(0, 1, 40 + Math.round(60 * Math.random()));
                chart.draw(info, options);
            }, 1000);
            setInterval(() => {
                info.setValue(1, 1, 40 + Math.round(60 * Math.random()));
                chart.draw(info, options);
            }, 5000);
            setInterval(() => {
                info.setValue(2, 1, 60 + Math.round(20 * Math.random()));
                chart.draw(info, options);
            }, 10000);
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

module.exports = GaugeChart;
