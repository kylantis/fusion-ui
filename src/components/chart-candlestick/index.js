class CandlestickChart extends BaseComponent {
    tagName() {
        return 'candlestickChart';
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
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = google.visualization.arrayToDataTable(data['>'], true);

            const options = {
                chartArea: {
                    width: data['@chartWidth'],
                    height: data['@chartHeight'],
                },
                title: data['@title'],
                width: data['@width'],
                height: data['@height'],
                backgroundColor: data['@backgroundColor'] || 'white',
                legend: {
                    position: data['@legendPosition'],
                    maxLines: 3,
                },
                aggregationTarget: data['@aggregationTarget'],
                bar: { groupWidth: `${data['@barWidth'] || 61.8}%` },
                enableInteractivity: data['@enableInteractivity'],
                forceIframe: data['@forceIFrame'],
                fontSize: data['@fontSize'],
                fontName: data['@fontName'],
                orientation: data['@orientation'],
                colors: data['@colors'],
                reverseCategories: data['@reverseCategories'],
                selectionMode: data['@selectionMode'],
                candlestick: {
                    hollowIsRising: data['@hollowIsRising'],
                    fallingColor: {
                        fill: data['@candlestick']['@fallingColor']['@fill'] || 'auto',
                        stroke: data['@candlestick']['@fallingColor']['@stroke'] || 'auto',
                        strokeWidth: data['@candlestick']['@fallingColor']['@strokeWidth'] || 2,
                    },
                    risingColor: {
                        fill: data['@candlestick']['@risingColor']['@fill'] || 'auto',
                        stroke: data['@candlestick']['@risingColor']['@stroke'] || 'auto',
                        strokeWidth: data['@candlestick']['@risingColor']['@strokeWidth'] || 2,
                    },
                },
                hAxis: {
                    title: data['@hAxis']['@title'],
                    titleTextStyle: {
                        color: data['@hAxis']['@color'] || 'black',
                        fontName: data['@hAxis']['@fontName'],
                        fontSize: data['@hAxis']['@fontSize'],
                        bold: data['@hAxis']['@bold'] || true,
                        italic: data['@hAxis']['@italic'] || false,
                    },
                    maxValue: data['@hAxis']['@maxValue'],
                    minValue: data['@hAxis']['@minValue'],
                    direction: data['@hAxis']['@direction'],
                },
                vAxis: {
                    title: data['@vAxis']['@title'],
                    titleTextStyle: {
                        color: data['@vAxis']['@color'] || 'black',
                        fontName: data['@vAxis']['@fontName'],
                        fontSize: data['@vAxis']['@fontSize'],
                        bold: data['@vAxis']['@bold'] || true,
                        italic: data['@vAxis']['@italic'] || false,
                    },
                    maxValue: data['@vAxis']['@maxValue'],
                    minValue: data['@vAxis']['@minValue'],
                    direction: data['@vAxis']['@direction'],
                },
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
            };

            const chart = new google.visualization.CandlestickChart(document.getElementById(data['@id']));

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

module.exports = CandlestickChart;
