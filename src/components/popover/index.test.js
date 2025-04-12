
const Popover = require('./index');

class PopoverTest extends Popover {
    setPosition(...args) {
        if (!self.appContext) return;
        return super.setPosition(...args);
    }
}

module.exports = PopoverTest;