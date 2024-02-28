/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class WebRenderer extends CustomCtxRenderer {
  static #loadedStyles = [];
  static #loadedScripts = [];

  constructor({
    id, input, logger, config,
  } = {}) {
    super({
      id, input, logger, config,
    });
  }

  // #API
  isHeadlessContext() {
    return self.appContext.server;
  }

  load(opts) {
    let deps = [];
    // eslint-disable-next-line no-restricted-globals
    if (!this.isHeadlessContext()) {
      deps = [
        this.loadCSSDependencies(),
        this.loadJSDependencies(),
      ];
    }
    return Promise.all(deps).then(() => super.load(opts));
  }

  #getDependencies(arr) {
    return arr.map(dep => {
      const { predicate } = dep;
      if (predicate) {
        if (!this[predicate].bind(this)()) {
          return false;
        } else {
          delete dep.predicate;
        }
      }
      return dep;
    })
      .filter(d => d);
  }

  cssDependencies() {
    return this.#getDependencies(
      this.getSyntheticMethod({ name: 'cssDependencies' })()
    )
      .map(({ url }) => url);
  }

  jsDependencies() {
    return this.#getDependencies(
      this.getSyntheticMethod({ name: 'jsDependencies' })()
    );
  }

  loadCSSDependencies() {
    const timeout = 5000;
    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      const loaded = [];
      let styles = [...new Set(this.cssDependencies())];
      // Filter styles that have previously loaded
      styles = styles
        .filter(style => !WebRenderer.#loadedStyles.includes(style));

      if (!styles.length) {
        return resolve([]);
      }

      styles.forEach((url) => {
        if (WebRenderer.#loadedStyles.includes(url)) {
          return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.type = 'text/css';
        link.async = false;
        // eslint-disable-next-line func-names
        const _this = this;
        link.onload = function () {
          loaded.push(this.href);
          // _this.logger.info(`Loaded ${this.href}`);
          if (loaded.length === styles.length) {
            resolve();
          }
        };
        link.onerror = () => reject(this.href);
        document.body.appendChild(link);

        WebRenderer.#loadedStyles.push(url);
      });
      // eslint-disable-next-line consistent-return
      setTimeout(() => {
        if (loaded.length < styles.length) {
          return reject(styles[loaded.length].url);
        }
      }, timeout);
    });
  }

  loadJSDependencies() {
    // eslint-disable-next-line no-restricted-globals
    const { appContext } = self;
    const dependencies =
      [...new Set(this.jsDependencies())]
        .map((dep) => {
          if (dep.constructor.name === 'String') {
            dep = { url: dep };
          }
          return dep;
        })
        .filter(({ url }) => !WebRenderer.#loadedScripts.includes(url))

    return appContext.fetchAll(dependencies)
      .then(() => {
        dependencies.forEach(({ url }) => {
          if (!WebRenderer.#loadedScripts.includes(url)) {
            WebRenderer.#loadedScripts.push(url);
          }
        })
      });
  }
}

module.exports = WebRenderer;
