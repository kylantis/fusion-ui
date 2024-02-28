
class ExpandableSection extends components.LightningComponent {

    toggleExpanded() {
        const input = this.getInput();
        input.expanded = !input.expanded;
    }
}

module.exports = ExpandableSection;