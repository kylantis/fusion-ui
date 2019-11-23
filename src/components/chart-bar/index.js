class BarChart extends BaseComponent {
    tagName() {
        return 'barChart';
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

        // eslint-disable-next-line no-undef
        google.charts.load('current', { packages: ['bar'] });
        google.charts.setOnLoadCallback(drawStuff);

        function drawStuff() {
            const info = new google.visualization.arrayToDataTable(data['>']);

            const options = {
                chart: {
                    title: data['@title'],
                    subtitle: data['@subtitle'],
                },
                bars: 'horizontal', // Required for Material Bar Charts.
                forceIframe: data['@forceIFrame'],
                selectionMode: data['@selectionMode'],
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                color: data['@colors'],
                legend: { position: data['@legendPosition'], maxLines: 3 },
                axes: {
                    x: {
                        0: { side: `${data['@xAxisPosition']}`, label: `${data['@hAxis']['@title']}` }, // Top x-axis.
                    },
                },
            };

            const chart = new google.charts.Bar(document.getElementById(data['@id']));
            chart.draw(info, options);
        }
    }

    initMultipleMaterialChart() {
        const { data } = this;

        // eslint-disable-next-line no-undef
        google.charts.load('current', { packages: ['bar'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                chart: {
                    title: data['@title'],
                    subtitle: data['@subtitle'],
                },
                bars: 'horizontal', // Required for Material Bar Charts.
                forceIframe: data['@forceIFrame'],
                selectionMode: data['@selectionMode'],
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                color: data['@colors'],
                legend: { position: data['@legendPosition'], maxLines: 3 },
                hAxis: {
                    title: data['@hAxis']['@title'],
                    titleTextStyle: {
                        color: data['@hAxis']['@color'] || 'black',
                        fontName: data['@hAxis']['@fontName'],
                        fontSize: data['@hAxis']['@fontSize'],
                        bold: data['@hAxis']['@bold'] || false,
                        italic: data['@hAxis']['@italic'] || false,
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
                },
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
                bar: { groupWidth: `${data['@barWidth']}%` },
            };
            if (data['@xAxisPosition'] === 'dual') {
                delete options.hAxis;
                options.series = {
                    0: { axis: data['@bottomXSeries'] },
                    1: { axis: data['@topXSeries'] },
                };
                options.axes = {
                    x: {
                        distance: { label: data['@bottomXLabel'] }, // Bottom x-axis.
                        brightness: { side: 'top', label: data['@topXLabel'] }, // Top x-axis.
                    },
                };
            }

            // eslint-disable-next-line no-undef
            const chart = new google.charts.Bar(document.getElementById(data['@id']));

            // eslint-disable-next-line no-undef
            chart.draw(info, google.charts.Bar.convertOptions(options));
        }
    }

    initSingleBarChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['corechart', 'bar'] });
        google.charts.setOnLoadCallback(drawChart);
        function drawChart() {
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                title: data['@title'],
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                bar: { groupWidth: `${data['@barWidth']}%` },
                legend: { position: data['@legendPosition'], maxLines: 3 },
                isStacked: data['@stacked'],
                titleTextStyle: {
                    color: data['@titleTextStyle']['@color'] || 'black',
                    fontName: data['@titleTextStyle']['@fontName'],
                    fontSize: data['@titleTextStyle']['@fontSize'],
                    bold: data['@titleTextStyle']['@bold'] || true,
                    italic: data['@titleTextStyle']['@italic'] || false,
                },
                fontSize: data['@fontSize'],
                fontName: data['@fontName'],
                interpolateNulls: data['@interpolateNulls'],
                pointShape: data['@pointShape'],
                pointSize: data['@pointSize'],
                enableInteractivity: data['@enableInteractivity'],
                forceIframe: data['@forceIFrame'],
                selectionMode: data['@selectionMode'],
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
                    maxValue: data['@hAxis']['@maxValue'],
                    minValue: data['@hAxis']['@minValue'],
                },
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
            };
            // eslint-disable-next-line no-undef
            const chart = new google.visualization.BarChart(document.getElementById(data['@id']));
            chart.draw(info, options);
        }
    }

    initMultipleBarChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['corechart', 'bar'] });
        google.charts.setOnLoadCallback(drawBarColors);

        function drawBarColors() {
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
                color: data['@colors'],
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                legend: {
                    position: data['@legendPosition'],
                    maxLines: 3,
                },
                enableInteractivity: data['@enableInteractivity'],
                forceIframe: data['@forceIFrame'],
                fontSize: data['@fontSize'],
                fontName: data['@fontName'],
                interpolateNulls: data['@interpolateNulls'],
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
                },
                bar: { groupWidth: `${data['@barWidth']}%` },
                isStacked: data['@stacked'],
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
            };
            const chart = new google.visualization.BarChart(document.getElementById(data['@id']));
            chart.draw(info, options);
        }
    }

    render() {
        const { node } = this;

        const chartDiv = document.createElement('div');
        chartDiv.id = this.data['@id'];
        node.append(chartDiv);

        if (this.data['@type'] === 'classic-single bar chart') {
            this.initSingleBarChart();
        } else if (this.data['@type'] === 'classic-multiple bar chart') {
            this.initMultipleBarChart();
        } else if (this.data['@type'] === 'material-single bar chart') {
            this.initSingleMaterialChart();
        } else if (this.data['@type'] === 'material-multiple bar chart') {
            this.initMultipleMaterialChart();
        }
    }
}

module.exports = BarChart;
