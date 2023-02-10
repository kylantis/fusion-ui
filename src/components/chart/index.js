
/**
 * Charts is powered by https://frappe.io/
 */

// Todo: Create HeatMap component
// Todo: Add data binding capability via hooks

class Chart extends components.LightningComponent {

    initCompile() {
        this.getInput().title;
        this.getInput().type;
        this.getInput().height;
        this.getInput().truncateLegends;
        this.getInput().colors[0];
        this.getInput().labels[0];
        this.getInput().datasets[0].name;
        this.getInput().datasets[0].chartType;
        this.getInput().datasets[0].values[0];
        this.getInput().yMarkers[0].label;
        this.getInput().yMarkers[0].value;
        this.getInput().yMarkers[0].options.labelPos;

        this.getInput().yRegions[0].label;
        this.getInput().yRegions[0].start;
        this.getInput().yRegions[0].end;
        this.getInput().yRegions[0].options.labelPos;

        this.getInput().axisOptions.xAxisMode;
        this.getInput().axisOptions.yAxisMode;
        this.getInput().axisOptions.xIsSeries;
        this.getInput().barOptions.spaceRatio;
        this.getInput().barOptions.stacked;
        this.getInput().barOptions.height;
        this.getInput().lineOptions.regionFill;
        this.getInput().lineOptions.hideDots;
        this.getInput().lineOptions.hideLine;
        this.getInput().lineOptions.heatline;
        this.getInput().lineOptions.spline;
        this.getInput().lineOptions.dotSize;
        this.getInput().isNavigable;
        this.getInput().valuesOverPoints;
        this.getInput().maxSlices;
        this.getInput().animate;
    }

    static fisherYatesShuffle(array) {
        let currentIndex = array.length,  randomIndex;
      
        // While there remain elements to shuffle.
        while (currentIndex != 0) {
      
          // Pick a remaining element.
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex--;
      
          // And swap it with the current element.
          [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
        }
      
        return array;
    }

    static getDefaultColors() {
        const { fisherYatesShuffle } = Chart;

        const DEFAULT_COLORS_A = [
            '#F56B6B',
            "#318ad8",
            "rgb(47, 162, 91)"
        ];

        const DEFAULT_COLORS_B = [
            "#BFDDF7",
            "#4169e1",
            "#7cd6fd",
            "#00bdff",
            "rgb(246, 131, 174)",
            "rgb(49, 138, 216)",
            "rgb(72, 187, 116)",
            "rgb(166, 177, 185)",
            "rgb(245, 107, 107)",
            "rgb(250, 207, 122)",
            "rgb(68, 66, 123)",
            "rgb(95, 216, 196)",
            "rgb(68, 66, 123)",
            "rgb(250, 207, 122)",
            "rgb(166, 177, 185)"
        ];

        return [
            ...fisherYatesShuffle(DEFAULT_COLORS_A),
            ...fisherYatesShuffle(DEFAULT_COLORS_B),
        ];
    }

    beforeMount() {
        const { getDefaultColors } = Chart;
        const input = this.getInput();
        const { colors } = input;

        if (!colors || !colors.length) {
            input.colors = getDefaultColors();
        }
    }

    jsDependencies() {
        return [
            ...super.jsDependencies(),
            {
                // url: 'https://cdn.jsdelivr.net/npm/frappe-charts@1/dist/frappe-charts.min.cjs.min.js',
                url: '/assets/js/cdn/frappe-charts.min.js',
                namespace: 'frappe',
            }
        ];
    }

    getData() {
        const { labels, datasets, yMarkers, yRegions } = this.getInput();
        return clientUtils.deepClone({ labels, datasets, yMarkers, yRegions });
    }

    onMount() {
        const { getWrapperCssClass } = BaseComponent;
        const {
            type, title, height, colors, truncateLegends, maxSlices, animate,
            axisOptions, barOptions, lineOptions, isNavigable, valuesOverPoints,
        } = this.getInput();

        this.node.classList.remove(getWrapperCssClass());

        this.chart = new frappe.Chart(this.node,
            {
                title, type, height, colors, truncateLegends, maxSlices, axisOptions,
                barOptions, lineOptions, isNavigable, valuesOverPoints, animate,
                data: this.getData(),
            }
        );

        this.chart.parent.addEventListener('data-select', (e) => {
            this.dispatchEvent('select', e.label, e.index, e.values);
        });
    }

    events() {
        return ['select'];
    }

    behaviours() {
        return [
            'push', 'addDataPoint', 'removeDataPoint', 'update', 'export', 'startPulsateCurrentDataPoint', 'stopPulsateCurrentDataPoint', 
            'setCurrentDataPoint'
        ];
    }

    setCurrentDataPoint(index=0) {
        this.chart.setCurrentDataPoint(index)
    }

    getCurrentDataPointCircle() {
        return this.node.querySelector(
            ':scope > .chart-container > svg > .chart-draw-area > circle'
        );
    }

    startPulsateCurrentDataPoint() {
        this.pulsateSelectionIntervalId = setInterval(() => {
            if (this.isCurrentDataPointVisible()) {
                this.hideCurrentDataPoint0();
            } else {
                this.showCurrentDataPoint0();
            };
        }, 250);
    }

    stopPulsateCurrentDataPoint() {
        clearInterval(this.pulsateSelectionIntervalId);
        this.pulsateSelectionIntervalId = null;
        this.showCurrentDataPoint0();
    }

    isCurrentDataPointVisible() {
        const node = this.getCurrentDataPointCircle();
        if (node) {
            const { visibility } = node.style;
            return !visibility || visibility == 'visible';
        }
        return false;
    }

    hideCurrentDataPoint() {
        this.hideCurrentDataPoint0();
    }

    hideCurrentDataPoint0(useDisplay) {
        if (this.getCurrentDataPointCircle()) {
            if (useDisplay) {
                this.getCurrentDataPointCircle().style.display = 'none';
            } else {
                this.getCurrentDataPointCircle().style.visibility = 'hidden';
            }
        }
    }

    showCurrentDataPoint() {
        this.showCurrentDataPoint0();
    }

    showCurrentDataPoint0(useDisplay) {
        if (this.getCurrentDataPointCircle()) {
            if (useDisplay) {
                this.getCurrentDataPointCircle().style.display = 'inline';
            } else {
                this.getCurrentDataPointCircle().style.visibility = 'visible';
            }
        }
    }

    push(label, valueFromEachDataset) {

        const input = this.getInput();
        const { labels, datasets } = input;

        input.labels = [...labels.slice(1), label];

        valueFromEachDataset.forEach((v, i) => {
            if (!datasets[i]) return;

            datasets[i].values = [
                ...datasets[i].values.slice(1),
                v,
            ];
        });

        this.hideCurrentDataPoint0(true);

        this.update();

        if (!this.pulsateSelectionIntervalId) {
            setTimeout(() => {
                this.showCurrentDataPoint0(true);
            }, 500)
        }
    }

    addDataPoint(label, index, valueFromEachDataset) {
        this.chart.addDataPoint(label, valueFromEachDataset, index)
    }

    removeDataPoint(index) {
        this.chart.removeDataPoint(index);
    }

    export() {
        this.chart.export();
    }

    update() {
        this.chart.update(this.getData());
    }
}
module.exports = Chart;