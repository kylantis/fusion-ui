
class ActivityTimeline extends BaseComponent {

    init() { }

    itemTransform({ node, blockData }) {
        const li = node.querySelector(':scope > li');

        // const items = this.items || (this.items = []);


    }

    /**
     * This is needed to be able to inline the sylesheets below
     */
    escapeString() {
        return false;
    }

    /**
     * This helper is created because we can't use mustache expressions
     * within stylesheets as that would invalidate our entire html.
     * 
     * The disadvantage of doing this is that we cannot dynamically
     * update lineColor. 
     * 
     * Todo: use hooks instead to take advantage of data-binding capabilities
     */
    getItemStyleRules(identifier, lineColor) {
        let rules = '';
        if (lineColor) {
            rules += `
            .slds-timeline__item_lc_${identifier}:before{
                background:${lineColor}!important;
            }`;
        }
        return rules ? `<style>${rules}</style>` : '';
    }

}
module.exports = ActivityTimeline;