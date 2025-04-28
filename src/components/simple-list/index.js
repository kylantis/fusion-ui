
class SimpleList extends components.LightningComponent {

    noOp(x) {
        return x;
    }

    useWeakRef() {
        return false;
    }

    getRandomColor() {
        // generate random r, g, b values
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        // convert to hexadecimal format and return
        return "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
    }

}
module.exports = SimpleList;