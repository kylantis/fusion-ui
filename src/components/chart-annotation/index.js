class AnnotationChart extends BaseComponent {
    tagName() {
        return 'annotationChart';
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
        google.charts.load('current', { packages: ['annotationchart'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = new google.visualization.DataTable();
            data['@columns'].forEach((el) => {
                info.addColumn(el['@type'], el['@tite']);
            });
            info.addRows(data['>']);

            const chart = new google.visualization.AnnotationChart(document.getElementById(data['@id']));

            const options = {
                displayAnnotations: true,
                height: data['@chartHeight'],
                width: data['@chartWidth'],
                displayZoomButtons: data['@displayZoomButtons'],
                colors: data['@colors'],
                thickness: data['@thickness'],
                displayAnnotationsFilter: data['@displayAnnotationsFilter'],
                displayExactValues: data['@displayExactValues'],
                displayRangeSelector: data['@displayRangeSelector'],
                fill: data['@fill'],
            };

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

module.exports = AnnotationChart;
