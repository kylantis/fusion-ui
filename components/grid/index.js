class Grid extends BaseComponent {
    constructor(data, node) {
        super(data, node);
        this.data = data;
        this.node = node;
    }

    tagName() {
        return "grid";
    }
}