class GeoChart extends BaseComponent {
    tagName() {
        return 'geoChart';
    }

    componentId = this.getId();

    getJsDependencies() {
        return (['https://www.gstatic.com/charts/loader.js']);
    }

    initChart() {
        const { data } = this;

        google.charts.load('current', {
            packages: ['geochart'],
            // Note: you will need to get a mapsApiKey for your project.
            // See: https://developers.google.com/chart/interactive/docs/basic_load_libs#load-settings
            mapsApiKey: 'get api key',
        });
        google.charts.setOnLoadCallback(drawRegionsMap);

        function drawRegionsMap() {
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                displayMode: data['@displayMode'],
                enableRegionInteractivity: data['@enableRegionInteractivity'],
                width: data['@chartWidth'],
                height: data['@chartHeight'],
                keepAspectRatio: data['@keepAspectRatio'],
                magnifyingGlass: {
                    enable: data['@magnifyingGlass'],
                    zoomFactor: 7.5,
                },
            };
            if (data['@region'].length >= 1) {
                options.region = data['@region'];
            }
            if (data['@mapType'] === 'colored') {
                options.backgroundColor = data['@backgroundColor'];
                options.datalessRegionColor = data['@datalessRegionColor'];
                options.defaultColor = data['@defaultColor'];
                options.colorAxis = { colors: data['@colorAxis'] };
            }

            const chart = new google.visualization.GeoChart(document.getElementById(data['@id']));

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

module.exports = GeoChart;
