class WordTree extends BaseComponent {
    tagName() {
        return 'wordTree';
    }

    componentId = this.getId();

    getJsDependencies() {
        return (['https://www.gstatic.com/charts/loader.js']);
    }

    initChart() {
        const { data } = this;

        google.charts.load('current', { packages: ['wordtree'] });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            const info = google.visualization.arrayToDataTable(data['>']);

            const options = {
                wordtree: {
                    format: data['@format'],
                    word: data['@word'],
                    type: data['@type'],
                },
                forceIFrame: data['@forceIFrame'],
                height: data['@height'],
                width: data['@width'],
                colors: data['@colors'],
                fontName: data['@fontName'],
                maxFontSize: data['@maxFontSize'],
            };

            const chart = new google.visualization.WordTree(document.getElementById(data['@id']));
            chart.draw(info, options);
        }
    }

    render() {
        const { node } = this;

        const chartDiv = document.createElement('div');
        chartDiv.id = this.data['@id'];
        chartDiv.setAttribute('style', 'width: 1000px; height: 500px;');
        node.append(chartDiv);

        this.initChart();
    }
}

module.exports = WordTree;
