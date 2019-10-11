class ScatterChart extends BaseComponent {
    tagName() {
        return 'scatterChart';
    }

    componentId = this.getId();

    getJsDependencies() {
        return (['https://www.gstatic.com/charts/loader.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    initClassicChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['corechart'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
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
                width: data['@width'],
                height: data['@height'],
                selectionMode: data['@selectionMode'],
                backgroundColor: data['@backgroundColor'],
                colors: data['@colors'],
                fontName: data['@fontName'],
                fontSize: data['@fontSize'],
                enableInteractivity: data['@enableInteractivity'],
                pointShape: data['@pointShape'],
                pointSize: data['@pointSize'],
                hAxis: {
                    title: data['@hAxis']['@title'],
                    gridlines: {
                        color: data['@hAxis']['@gridlineColor'] || null,
                        count: data['@hAxis']['@count'] || null,
                    },
                    titleTextStyle: {
                        color: data['@hAxis']['@color'] || 'black',
                        fontName: data['@hAxis']['@fontName'],
                        fontSize: data['@hAxis']['@fontSize'],
                        bold: data['@hAxis']['@bold'] || true,
                        italic: data['@hAxis']['@italic'] || false,
                    },
                    // ticks: data['@hAxis']['@ticks'] || 'auto',
                    minValue: data['@hAxis']['@minValue'],
                    maxValue: data['@hAxis']['@maxValue'],
                },
                vAxis: {
                    title: data['@vAxis']['@title'],
                    gridlines: {
                        color: data['@vAxis']['@gridlineColor'] || null,
                        count: data['@vAxis']['@count'] || null,
                    },
                    titleTextStyle: {
                        color: data['@vAxis']['@color'] || 'black',
                        fontName: data['@vAxis']['@fontName'],
                        fontSize: data['@vAxis']['@fontSize'],
                        bold: data['@vAxis']['@bold'] || true,
                        italic: data['@vAxis']['@italic'] || false,
                    },
                    // ticks: data['@vAxis']['@ticks'] || 'auto',
                    minValue: data['@vAxis']['@minValue'],
                    maxValue: data['@vAxis']['@maxValue'],
                },
                legend: 'none',
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
            };
            if (data['@trendline']) {
                options.trendlines = {
                    0: {
                        type: 'linear',
                        color: 'green',
                        lineWidth: 3,
                        opacity: 0.3,
                        showR2: true,
                        visibleInLegend: true,
                    },
                };
            }

            const chart = new google.visualization.ScatterChart(document.getElementById(data['@id']));

            chart.draw(info, options);
        }
    }

    initMaterialChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['scatter'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = new google.visualization.DataTable();
            info.addColumn(data['@columns'][0]['@type'], data['@columns'][0]['@title']);
            info.addColumn(data['@columns'][1]['@type'], data['@columns'][1]['@title']);

            info.addRows(data['>']);

            const options = {
                chart: {
                    title: data['@title'],
                    subtitle: data['@subtitle'],
                },
                width: data['@width'],
                height: data['@height'],
                colors: data['@colors'],
                backgroundColor: data['@backgroundColor'],
                forceIFrame: data['@forceIFrame'],
                orientation: data['@orientation'],
                selectionMode: data['@selectionMode'],
                legend: {
                    position: data['@legendPosition'],
                    maxLines: 3,
                },
                enableInteractivity: data['@enableInteractivity'],
                hAxis: {
                    title: data['@hAxis']['@title'],
                },
                vAxis: {
                    title: data['@vAxis']['@title'],
                },
            };

            const chart = new google.charts.Scatter(document.getElementById(data['@id']));

            chart.draw(info, google.charts.Scatter.convertOptions(options));
        }
    }

    render() {
        const { node } = this;

        const chartDiv = document.createElement('div');
        chartDiv.id = this.data['@id'];
        node.append(chartDiv);

        if (this.data['@chartStyle'] === 'classicScatterChart') {
            this.initClassicChart();
        } else if (this.data['@chartStyle'] === 'materialScatterChart') {
            this.initMaterialChart();
        }
    }
}

module.exports = ScatterChart;
