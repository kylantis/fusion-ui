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
                chart: {
                    title: data['@title'],
                    subtitle: data['@subtitle'],
                },
                titleTextStyle: {
                    color: data['@titleTextStyle']['@color'] || 'black',
                    fontName: data['@titleTextStyle']['@fontName'],
                    fontSize: data['@titleTextStyle']['@fontSize'],
                    bold: data['@titleTextStyle']['@bold'] || true,
                    italic: data['@titleTextStyle']['@italic'] || false,
                },
                height: data['@chartHeight'],
                width: data['@chartWidth'],
                legend: { position: data['@legendPosition'], maxLines: 3 },
                fontSize: data['@fontSize'],
                fontName: data['@fontName'],
                forceIFrame: data['@forceIFrame'],
                selectionMode: data['@selectionMode'],
                isStacked: data['@stacked'],
                orientation: data['@orientation'],
                axes: {
                    x: {
                        0: { side: 'bottom', label: data['@hAxis']['@title'] },
                    },
                    y: {
                        0: { label: data['@vAxis']['@title'] },
                    },
                },
                bar: { groupWidth: `${data['@barWidth']}%` },
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
            };

            if (data['@yAxisView'] === 'dual') {
                delete options.axes.y;
                options.series = {
                    0: { targetAxisIndex: 0 },
                    1: { targetAxisIndex: 1 },
                };
                options.vAxes = {
                    0: { title: data['@leftLabelY'] },
                    1: { title: data['@rightLabelY'] },
                };
            }


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
            // eslint-disable-next-line no-undef
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                chart: {
                    title: data['@title'],
                    subtitle: data['@subtitle'],
                },
                titleTextStyle: {
                    color: data['@titleTextStyle']['@color'] || 'black',
                    fontName: data['@titleTextStyle']['@fontName'],
                    fontSize: data['@titleTextStyle']['@fontSize'],
                    bold: data['@titleTextStyle']['@bold'] || true,
                    italic: data['@titleTextStyle']['@italic'] || false,
                },
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                backgroundColor: {
                    fill: data['@backgroundColor'],
                },
                selectionMode: data['@selectionMode'],
                forceIFrame: data['@forceIFrame'],
                legend: { position: data['@legendPosition'], maxLines: 3 },
                isStacked: data['@stacked'],
                fontSize: data['@fontSize'],
                fontName: data['@fontName'],
                color: data['@colors'],
                vAxes: {
                    0: {
                        title: data['@vAxis']['@title'],
                    },
                },
                hAxes: {
                    0: {
                        title: data['@hAxis']['@title'],
                    },
                },
                reverseCategories: data['@reverseCategories'],
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
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
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                bar: { groupWidth: data['@barWidth'] },
                backgroundColor: {
                    fill: data['@backgroundColor'],
                },
                selectionMode: data['@selectionMode'],
                forceIFrame: data['@forceIFrame'],
                legend: { position: data['@legendPosition'], maxLines: 3 },
                isStacked: data['@stacked'],
                interpolateNulls: data['@interpolateNulls'],
                fontSize: data['@fontSize'],
                fontName: data['@fontName'],
                color: data['@colors'],
                enableInteractivity: data['@enableInteractivity'],
                titleTextStyle: {
                    color: data['@titleTextStyle']['@color'] || 'black',
                    fontName: data['@titleTextStyle']['@fontName'],
                    fontSize: data['@titleTextStyle']['@fontSize'],
                    bold: data['@titleTextStyle']['@bold'] || true,
                    italic: data['@titleTextStyle']['@italic'] || false,
                },
                hAxis: {
                    title: data['@hAxis']['@title'],
                    maxValue: data['@hAxis']['@maxValue'],
                    minValue: data['@hAxis']['@minValue'],
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
                    minValue: data['@vAxis']['@minValue'],
                    titleTextStyle: {
                        color: data['@vAxis']['@color'] || 'black',
                        fontName: data['@vAxis']['@fontName'],
                        fontSize: data['@vAxis']['@fontSize'],
                        bold: data['@vAxis']['@bold'] || true,
                        italic: data['@vAxis']['@italic'] || false,
                    },
                },
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
            };
            const chart = new google.visualization.ColumnChart(document.getElementById(data['@id']));
            chart.draw(info, options);
        }
    }

    render() {
        const { node } = this;

        const chartDiv = document.createElement('div');
        chartDiv.id = this.data['@id'];
        node.append(chartDiv);

        switch (this.data['@type']) {
        case 'classic-column chart':
            this.initSingleBarChart();
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
