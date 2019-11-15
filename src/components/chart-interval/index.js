class IntervalChart extends BaseComponent {
    tagName() {
        return 'intervalChart';
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

        function populateInterval() {
            // eslint-disable-next-line no-return-assign
            return data['@columns'].reduce((obj, item) => {
                // eslint-disable-next-line no-param-reassign
                obj[item['@id']] = {
                    style: item['@style'],
                    color: item['@color'],
                    lineWidth: item['@lineWidth'],
                };
                return obj;
            }, {});
        }

        function drawChart() {
            const info = new google.visualization.DataTable();
            info.addColumn('number', 'x');
            info.addColumn('number', 'values');
            data['@columns'].forEach((el) => {
                info.addColumn({ id: el['@id'], type: el['@type'], role: el['@role'] });
            });

            info.addRows(data['>']);
            // The intervals data as narrow lines (useful for showing raw source data)
            const optionsLines = {
                title: data['@title'],
                chartArea: {
                    width: data['@chartWidth'],
                    height: data['@chartHeight'],
                },
                width: data['@width'],
                height: data['@height'],
                enableInteractivity: data['@enableInteractivity'],
                curveType: data['@curveType'],
                lineWidth: data['@lineWidth'],
                forceIFrame: data['@forceIFrame'],
                series: [{
                    color: data['@colors'],
                }],
                intervals: {
                    style: data['@interval']['@style'],
                    lineWidth: data['@interval']['@lineWidth'],
                    barWidth: data['@interval']['@barWidth'],
                    pointSize: data['@interval']['@pointSize'],
                },
                legend: data['@legendPosition'],
                interval: populateInterval(),
                animation: {
                    startup: data['@animateChart'],
                    duration: data['@animationDuration'],
                    easing: data['@transitionStyle'],
                },
            };

            const chartLines = new google.visualization.LineChart(document.getElementById(data['@id']));
            chartLines.draw(info, optionsLines);
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

module.exports = IntervalChart;
