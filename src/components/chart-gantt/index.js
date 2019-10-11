class GanttChart extends BaseComponent {
    tagName() {
        return 'ganttChart';
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

        google.charts.load('current', { packages: ['gantt'] });
        google.charts.setOnLoadCallback(drawChart);

        // eslint-disable-next-line consistent-return
        function daysToMilliseconds(days) {
            if (days !== null) {
                return days * 24 * 60 * 60 * 1000;
            }
        }

        function drawChart() {
            const info = new google.visualization.DataTable();
            data['@columns'].forEach((el) => {
                info.addColumn(`${el['@type']}`, `${el['@title']}`);
            });
            const dataArr = data['>'].map((el) => {
                // eslint-disable-next-line no-param-reassign
                el[4] = daysToMilliseconds(el[4]);
                return el;
            });

            info.addRows(dataArr);

            const options = {
                title: 'Gantt Chart',
                width: data['@width'],
                height: data['@height'],
                backgroundColor: {
                    fill: data['@backgroundColor'],
                },
                gantt: {
                    arrow: {
                        angle: 45,
                        color: data['@arrow']['@color'] || '#000',
                        length: data['@arrow']['@length'] || 8,
                        radius: data['@arrow']['@radius'] || 15,
                        width: data['@arrow']['@width'] || 1.4,
                    },
                    barCornerRadius: data['@barCornerRadius'] || 4,
                    barHeight: data['@barHeight'] || null,
                    criticalPathEnabled: data['@criticalPathEnabled'],
                    criticalPathStyle: {
                        stroke: data['@criticalPathstroke'],
                        strokeWidth: data['@criticalPathstrokeWidth'],
                    },
                    shadowEnabled: data['@shadowEnabled'],
                    shadowColor: data['@shadowColor'] || '#000',
                    shadowOffset: data['@shadowOffset'],
                    trackHeight: data['@trackHeight'],
                    percentEnabled: data['@percentEnabled'],
                    percentStyle: {
                        fill: data['@percentStyleFill'],
                    },
                },

            };

            const chart = new google.visualization.Gantt(document.getElementById(data['@id']));
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

module.exports = GanttChart;
