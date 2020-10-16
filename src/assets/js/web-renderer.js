/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class WebRenderer extends CustomCtxRenderer {
  constructor({
    id, input, loadable,
  } = {}) {
    super({ id, input, loadable });
  }

  load({ parent, token }) {
    // Promise.all([
    //   this.loadCSSDependencies(),
    //   this.loadJSDependencies(),
    // ])
    return Promise.resolve()
      .then(() => super.load({ parent, token }));
  }

  cssDependencies() {
    return this.getSyntheticMethod({ name: 'cssDependencies' })();
  }

  jsDependencies() {
    return this.getSyntheticMethod({ name: 'jsDependencies' })();
  }

  loadCSSDependencies(timeout = 5000) {
    const { loadedStyles } = WebRenderer;

    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      const loaded = [];
      let styles = [...this.cssDependencies()];
      // Filter styles that have previously loaded
      styles = styles.filter(style => !loadedStyles
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
          loadedStyles.push(this.href);
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

  loadJSDependencies(timeout = 5000) {
    const { loadedScripts } = WebRenderer;

    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      const loaded = [];
      let scripts = [...this.jsDependencies()];
      // Objectify string entries
      scripts = scripts.map(script => (script.constructor.name === 'String' ? {
        url: script,
      } : script));
      // Filter scripts that have previously loaded
      scripts = scripts.filter(script => !loadedScripts
        .includes((script.url.startsWith('/') ? window.location.origin : '') + script.url));

      if (!scripts.length) {
        return resolve();
      }

      this.logger.info(`Loading ${scripts.length} JS dependencies`);

      scripts.forEach((elem) => {
        const script = document.createElement('script');
        script.src = elem.url;

        script.type = 'text/javascript';
        script.async = false;
        // eslint-disable-next-line func-names
        script.onload = function () {
          loaded.push(this.src);
          loadedScripts.push(this.src);

          if (elem.onload) {
            // eslint-disable-next-line no-eval
            eval(elem.onload);
          }
          this.logger.info(`Loaded ${this.src}`);
          if (loaded.length === scripts.length) {
            resolve();
          }
        };
        script.onerror = () => reject(this.src);


        document.body.appendChild(script);
      });

      // eslint-disable-next-line consistent-return
      setTimeout(() => {
        if (loaded.length < scripts.length) {
          return reject(scripts[loaded.length].url);
        }
      }, timeout);
    });
  }
}
WebRenderer.loadedStyles = [];
WebRenderer.loadedScripts = [];

module.exports = WebRenderer;
