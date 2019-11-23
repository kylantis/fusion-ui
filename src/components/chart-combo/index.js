class ComboChart extends BaseComponent {
    tagName() {
        return 'comboChart';
    }

    componentId = this.getId();

    getJsDependencies() {
        return (['https://www.gstatic.com/charts/loader.js']);
    }

    initChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['corechart'] });
        google.charts.setOnLoadCallback(drawVisualization);

        function myReadyHandler() {
            // console.log('ready');
        }

        function drawVisualization() {
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                title: data['@title'],
                titleTextStyle: {
                    color: data['@titleTextStyle']['@color'] || 'black',
                    fontName: data['@titleTextStyle']['@fontName'],
                    fontSize: data['@titleTextStyle']['@fontSize'],
                    bold: data['@titleTextStyle']['@bold'] || true,
                    italic: data['@titleTextStyle']['@italic'] || false,
                },
                vAxis: {
                    title: data['@vAxisTitle'],
                },
                hAxis: {
                    title: data['@hAxisTitle'],
                },
                seriesType: 'bars',
                series: {
                    5: {
                        type: 'line',
                    },
                },
                colors: data['@colors'],
                backgroundColor: data['@backgroundColor'],
                forceIFrame: data['@forceIFrame'],
                legend: { position: data['@legendPosition'], maxLines: 3 },
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                orientation: data['@orientation'],
                enableInteractivity: data['@enableInteractivity'],
                pointShape: data['@pointShape'],
                pointSize: data['@pointSize'],
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
            };

            const chart = new google.visualization.ComboChart(document.getElementById(data['@id']));
            chart.draw(info, options);
            google.visualization.events.addListener(chart, 'ready', myReadyHandler);
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

module.exports = ComboChart;
