class LineChart extends BaseComponent {
    tagName() {
        return 'lineChart';
    }

    componentId = this.getId();

    getJsDependencies() {
        return (['https://www.gstatic.com/charts/loader.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    initClassicComplexChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['corechart', 'line'] });
        google.charts.setOnLoadCallback(drawBasic);

        function drawBasic() {
            const info = new google.visualization.DataTable();
            data['@columns'].forEach((val) => {
                info.addColumn(`${val['@type']}`, `${val['@title']}`);
            });

            info.addRows(data['>']);

            const options = {
                title: data['@title'],
                curveType: data['@curveType'],
                legend: { position: data['@legendPosition'] },
                animation: {
                    startup: true,
                    duration: 2000,
                    easing: 'linear',
                },
                titleTextStyle: {
                    color: data['@titleTextStyle']['@color'] || 'black',
                    fontName: data['@titleTextStyle']['@fontName'],
                    fontSize: data['@titleTextStyle']['@fontSize'],
                    bold: data['@titleTextStyle']['@bold'] || true,
                    italic: data['@titleTextStyle']['@italic'] || false,
                },
                fontSize: data['@fontSize'],
                fontName: data['@fontName'],
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                colors: data['@colors'],
                backgroundColor: data['@backgroundColor'],
                forceIFrame: data['@forceIFrame'],
                lineWidth: data['@lineWidth'],
                pointShape: data['@pointShape'],
                pointSize: data['@pointSize'],
                orientation: data['@orientation'],
                selectionMode: data['@selectionMode'],
                interpolateNulls: data['@interpolateNulls'],
                enableInteractivity: data['@enableInteractivity'],
                hAxis: {
                    title: data['@hAxis']['@title'],
                    maxValue: data['@hAxis']['@maxValue'],
                    minValue: data['@hAxis']['@maxValue'],
                    titleTextStyle: {
                        color: data['@hAxis']['@color'] || 'black',
                        fontName: data['@hAxis']['@fontName'],
                        fontSize: data['@hAxis']['@fontSize'],
                        bold: data['@hAxis']['@bold'] || true,
                        italic: data['@hAxis']['@italic'] || false,
                    },
                },
                vAxis: {
                    title: data['@vAxis']['@title'],
                    maxValue: data['@vAxis']['@maxValue'],
                    minValue: data['@vAxis']['@maxValue'],
                    titleTextStyle: {
                        color: data['@vAxis']['@color'] || 'black',
                        fontName: data['@vAxis']['@fontName'],
                        fontSize: data['@vAxis']['@fontSize'],
                        bold: data['@vAxis']['@bold'] || true,
                        italic: data['@vAxis']['@italic'] || false,
                    },
                },
            };

            const chart = new google.visualization.LineChart(document.getElementById(data['@id']));

            chart.draw(info, options);
        }
    }

    initChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['corechart', 'line'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                title: data['@title'],
                curveType: data['@curveType'],
                legend: { position: data['@legendPosition'] },
                animation: {
                    startup: true,
                    duration: 2000,
                    easing: 'linear',
                },
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                colors: data['@colors'],
                backgroundColor: data['@backgroundColor'],
                forceIFrame: data['@forceIFrame'],
                lineWidth: data['@lineWidth'],
                pointShape: data['@pointShape'],
                pointSize: data['@pointSize'],
                orientation: data['@orientation'],
                selectionMode: data['@selectionMode'],
                enableInteractivity: data['@enableInteractivity'],
                hAxis: {
                    title: data['@hAxis']['@title'],
                    maxValue: data['@hAxis']['@maxValue'],
                    minValue: data['@hAxis']['@maxValue'],
                },
                vAxis: {
                    title: data['@vAxis']['@title'],
                    maxValue: data['@vAxis']['@maxValue'],
                    minValue: data['@vAxis']['@maxValue'],
                },
            };

            const chart = new google.visualization.LineChart(document.getElementById(data['@id']));

            chart.draw(info, options);
        }
    }

    initComplexMaterialChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['line'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = new google.visualization.DataTable();
            data['@columns'].forEach((val) => {
                info.addColumn(`${val['@type']}`, `${val['@title']}`);
            });

            info.addRows(data['>']);

            const options = {
                chart: {
                    title: data['@title'],
                    subtitle: data['@subtitle'],
                },
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                colors: data['@colors'],
                backgroundColor: data['@backgroundColor'],
                forceIFrame: data['@forceIFrame'],
                lineWidth: data['@lineWidth'],
                legend: { position: data['@legendPosition'], maxLines: 3 },
                enableInteractivity: data['@enableInteractivity'],
                orientation: data['@orientation'],
                hAxis: {
                    title: data['@hAxis']['@title'],
                    maxValue: data['@hAxis']['@maxValue'],
                    minValue: data['@hAxis']['@maxValue'],
                },
                vAxis: {
                    title: data['@vAxis']['@title'],
                    maxValue: data['@vAxis']['@maxValue'],
                    minValue: data['@vAxis']['@maxValue'],
                },
            };

            const chart = new google.charts.Line(document.getElementById(data['@id']));

            chart.draw(info, google.charts.Line.convertOptions(options));
        }
    }

    render() {
        const { node } = this;

        const chartDiv = document.createElement('div');
        chartDiv.id = this.data['@id'];
        chartDiv.setAttribute('style', 'width: 900px; height: 500px;');
        node.append(chartDiv);

        if (this.data['@type'] === 'classic chart' && this.data['@complexity'] === 'simple') {
            this.initChart();
        } else if (this.data['@type'] === 'classic chart' && this.data['@complexity'] === 'complex') {
            this.initClassicComplexChart();
        } else if (this.data['@type'] === 'material chart' && this.data['@complexity'] === 'complex') {
            this.initComplexMaterialChart();
        }
    }
}

module.exports = LineChart;
