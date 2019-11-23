class BubbleChart extends BaseComponent {
    tagName() {
        return 'bubbleChart';
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

        google.charts.load('current', { packages: ['corechart'] });
        google.charts.setOnLoadCallback(drawSeriesChart);

        function drawSeriesChart() {
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
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                fontSize: data['@fontSize'],
                fontName: data['@fontName'],
                colors: data['@colors'],
                enableInteractivity: data['@enableInteractivity'],
                forceIframe: data['@forceIFrame'],
                legend: {
                    position: data['@legendPosition'],
                    maxLines: 3,
                },
                hAxis: {
                    title: data['@hAxis']['@title'],
                    titleTextStyle: {
                        color: data['@hAxis']['@color'] || 'black',
                        fontName: data['@hAxis']['@fontName'],
                        fontSize: data['@hAxis']['@fontSize'],
                        bold: data['@hAxis']['@bold'] || false,
                        italic: data['@hAxis']['@italic'] || false,
                    },
                    maxValue: data['@hAxis']['@maxValue'],
                    minValue: data['@hAxis']['@minValue'],
                    gridlines: {
                        color: data['@hAxis']['@gridlineColor'] || null,
                        count: data['@hAxis']['@count'] || null,
                    },
                },
                vAxis: {
                    title: data['@vAxis']['@title'],
                    titleTextStyle: {
                        color: data['@vAxis']['@color'] || 'black',
                        fontName: data['@vAxis']['@fontName'],
                        fontSize: data['@vAxis']['@fontSize'],
                        bold: data['@vAxis']['@bold'] || false,
                        italic: data['@vAxis']['@italic'] || false,
                    },
                    maxValue: data['@vAxis']['@maxValue'],
                    minValue: data['@vAxis']['@minValue'],
                    gridlines: {
                        color: data['@vAxis']['@gridlineColor'] || null,
                        count: data['@vAxis']['@count'] || null,
                    },
                },
                bubble: {
                    textStyle: {
                        fontSize: data['@bubble']['@fontSize'] || 12,
                        fontName: data['@bubble']['@fontName'] || 'Times New Roman',
                        color: data['@bubble']['@color'] || 'black',
                        bold: data['@bubble']['@bold'] || true,
                        italic: data['@bubble']['@italic'] || true,
                    },
                },
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
            };

            const chart = new google.visualization.BubbleChart(document.getElementById(data['@id']));
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

module.exports = BubbleChart;
