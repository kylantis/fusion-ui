class Histogram extends BaseComponent {
    tagName() {
        return 'histogram';
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
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                title: data['@title'],
                width: data['@width'],
                height: data['@height'],
                colors: data['@colors'],
                chartArea: {
                    width: data['@chartWidth'],
                    height: data['@chartHeight'],
                },
                legend: {
                    position: data['@legendPosition'],
                    maxLines: 3,
                },
                backgroundColor: data['@backgroundColor'],
                fontName: data['@fontName'],
                fontSize: data['@fontSize'],
                forceIFrame: data['@forceIFrame'],
                enableInteractivity: data['@enableInteractivity'],
                interpolateNulls: data['@interpolateNulls'],
                bar: {
                    groupWidth: data['@groupWidth'],
                },
                histogram: {
                    bucketSize: data['@histogram']['@bucketSize'],
                    maxNumBuckets: data['@histogram']['@maxNumBuckets'],
                    minValue: data['@histogram']['@minValue'],
                    maxValue: data['@histogram']['@maxValue'],
                },
                hAxis: {
                    title: data['@hAxis']['@title'],
                    gridlines: {
                        color: data['@hAxis']['@gridlineColor'] || null,
                        count: data['@hAxis']['@gridlineCount'] || null,
                    },
                    titleTextStyle: {
                        color: data['@hAxis']['@color'] || 'black',
                        fontName: data['@hAxis']['@fontName'],
                        fontSize: data['@hAxis']['@fontSize'],
                        bold: data['@hAxis']['@bold'] || true,
                        italic: data['@hAxis']['@italic'] || false,
                    },
                    ticks: data['@hAxis']['@ticks'] || 'auto',
                },
                vAxis: {
                    title: data['@vAxis']['@title'],
                    gridlines: {
                        color: data['@vAxis']['@gridlineColor'] || null,
                        count: data['@vAxis']['@gridlineCount'] || null,
                    },
                    titleTextStyle: {
                        color: data['@vAxis']['@color'] || 'black',
                        fontName: data['@vAxis']['@fontName'],
                        fontSize: data['@vAxis']['@fontSize'],
                        bold: data['@vAxis']['@bold'] || true,
                        italic: data['@vAxis']['@italic'] || false,
                    },
                    ticks: data['@vAxis']['@ticks'] || 'auto',
                },
            };

            const chart = new google.visualization.Histogram(document.getElementById(data['@id']));
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

module.exports = Histogram;
