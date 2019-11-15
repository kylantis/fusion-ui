class TreeMap extends BaseComponent {
    tagName() {
        return 'treeMap';
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

        google.charts.load('current', { packages: ['treemap'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
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
                showTooltips: data['@showTooltips'],
                minColor: data['@minColor'] || '#009688',
                midColor: data['@midColor'] || '#f7f7f7',
                maxColor: data['@maxColor'] || '#ee8100',
                maxDepth: data['@maxDepth'],
                headerHeight: data['@headerHeight'],
                headerColor: data['@headerColor'] || '#8c6bb1',
                highlightOnMouseOver: data['@highlightOnMouseOver'],
                headerHighlightColor: data['@headerHighlightColor'],
                fontColor: data['@fontColor'],
                fontFamily: data['@fontFamily'],
                showScale: true,
            };

            const tree = new google.visualization.TreeMap(document.getElementById(data['@id']));

            tree.draw(info, options);
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

module.exports = TreeMap;
