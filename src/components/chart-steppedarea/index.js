class SteppedAreaChart extends BaseComponent {
    tagName() {
        return 'steppedAreaChart';
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
        // Load the Visualization API and the corechart package.
        // eslint-disable-next-line no-undef
        google.charts.load('current', { packages: ['corechart'] });

        // Set a callback to run when the Google Visualization API is loaded.
        // eslint-disable-next-line no-undef
        google.charts.setOnLoadCallback(drawChart);

        // Callback that creates and populates a data table,
        // instantiates the pie chart, passes in the data and
        // draws it.
        function drawChart() {
            // Create the data table.
            // eslint-disable-next-line no-undef
            const info = google.visualization.arrayToDataTable(data['>']);

            // Set chart options
            const options = {
                title: data['@title'],
                legend: {
                    position: data['@legendPosition'],
                    maxLines: 3,
                },
                chartArea: {
                    width: data['@chartWidth'],
                    height: data['@chartHeight'],
                },
                isStacked: data['@stacked'],
                width: data['@width'],
                height: data['@height'],
                color: data['@colors'],
                pointShape: data['@pointShape'],
                pointSize: data['@pointSize'],
                enableInteractivity: data['@enableInteractivity'],
                forceIframe: data['@forceIFrame'],
                selectionMode: data['@selectionMode'],
                fontSize: data['@fontSize'],
                fontName: data['@fontName'],
                orientation: data['@orientation'],
                connectSteps: data['@connectSteps'],
                areaOpacity: data['@areaOpacity'],
                interpolateNulls: data['@interpolateNulls'],
                titleTextStyle: {
                    color: data['@titleTextStyle']['@color'] || 'black',
                    fontName: data['@titleTextStyle']['@fontName'],
                    fontSize: data['@titleTextStyle']['@fontSize'],
                    bold: data['@titleTextStyle']['@bold'] || true,
                    italic: data['@titleTextStyle']['@italic'] || false,
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

            // Instantiate and draw our chart, passing in some options.
            // eslint-disable-next-line no-undef
            const chart = new google.visualization.SteppedAreaChart(document.getElementById(data['@id']));
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

module.exports = SteppedAreaChart;
