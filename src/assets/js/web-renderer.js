/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class WebRenderer extends CustomCtxRenderer {

  constructor({
    id, input, logger, config, isRoot,
  } = {}) {
    super({
      id, input, logger, config, isRoot,
    });
  }

  // #API
  isHeadlessContext() {
    return !self.appContext || self.appContext.server;
  }

  load(opts) {
    let deps = [];
    // eslint-disable-next-line no-restricted-globals
    if (!this.isHeadlessContext() && !this.isRoot()) {
      deps = [
        this.loadCSSDependencies(),
        this.loadJSDependencies(),
      ];
    }
    return Promise.all(deps).then(() => super.load(opts));
  }

  cssDependencies() {
    return this.getSyntheticMethod({ name: 'ownCssDependencies' })()
  }

  jsDependencies() {
    return this.getSyntheticMethod({ name: 'ownJsDependencies' })()
  }

  loadCSSDependencies() {
    return self.appContext.loadCSSDependencies(
      this.cssDependencies()
    );
  }

  loadJSDependencies() {
    return self.appContext.loadJSDependencies(
      this.jsDependencies()
    );
  }
}

module.exports = WebRenderer;
