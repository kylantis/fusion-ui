/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class WebRenderer extends CustomCtxRenderer {
  static #loadedStyles = [];

  constructor({
    id, input, loadable, parent,
  } = {}) {
    super({
      id, input, loadable, parent,
    });
  }

  load({ parent, token }) {
    let promises = [];
    // eslint-disable-next-line no-restricted-globals
    if (self.appContext) {
      promises = [
        this.loadCSSDependencies(),
        this.loadJSDependencies(),
      ];
    }
    return Promise.all(promises)
      .then(() => super.load({ parent, token }));
  }

  cssDependencies() {
    return this.getSyntheticMethod({ name: 'cssDependencies' })();
  }

  jsDependencies() {
    return this.getSyntheticMethod({ name: 'jsDependencies' })();
  }

  loadCSSDependencies() {
    const timeout = 5000;
    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      const loaded = [];
      let styles = [...this.cssDependencies()];
      // Filter styles that have previously loaded
      styles = styles
        .filter(style => !WebRenderer.#loadedStyles
          .includes((style.startsWith('/') ? window.location.origin : '') + style));

      if (!styles.length) {
        return resolve([]);
      }

      this.logger.info(`Loading CSS dependencies: ${styles}`);

      styles.forEach((url) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.type = 'text/css';
        link.async = false;
        // eslint-disable-next-line func-names
        link.onload = function () {
          loaded.push(this.href);
          WebRenderer.#loadedStyles.push(this.href);
          this.logger.info(`Loaded ${this.href}`);
          if (loaded.length === styles.length) {
            resolve();
          }
        };
        link.onerror = () => reject(this.href);
        document.body.appendChild(link);
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
    const dependencies = this.jsDependencies()
      .map(appContext.toCanonicalDependency);

    return dependencies.reduce(
      (p, x) => p.then(_ => appContext.loadResource({
        url: x.url,
        moduleType: x.moduleType,
      })),
      Promise.resolve(),
    );
  }
}

module.exports = WebRenderer;
