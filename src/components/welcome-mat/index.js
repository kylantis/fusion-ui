
class WelcomeMat extends components.Modal {

    beforeRender() {
        const input = this.getInput();
        input.tabIndex = 0;
        input.bodyPadding = null;
    }

    getProgressInfo(tasks) {
        var numCompleted = tasks.filter(({ completed }) => completed).length;
        return `${numCompleted}/${tasks.length} units completed`;
    }
    
    events() {
        return ['taskClick'];
    }

    onTaskClick(evt) {
        const { parentElement: li } = evt.target;
        var identifier = li.getAttribute('identifier');

        this.dispatchEvent('taskClick', identifier);
    }
}
module.exports = WelcomeMat;