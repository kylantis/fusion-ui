
// eslint-disable-next-line no-undef
class WebRenderer extends CustomCtxRenderer {
  constructor({
    id, input, parent,
  } = {}) {
    super({ id, input });

    this.parent = parent;
    // eslint-disable-next-line no-extra-boolean-cast
    this.onClient = true;

    if (this.onClient) {
      window.global = window;
    }
  }

  renderHtml({ html }) {
    if (this.parent) {
      const container = document.createElement('div');
      container.id = `${this.getId()}-container`;
      container.innerHTML = html;

      this.parent.appendChild(container);
    }
    this.html = html;
  }

  load() {
    return this.onClient
      ? this.loadCSSDependencies().then(() => this.loadJSDependencies()).then(() => super.load())
      : super.load();
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

      console.log(`Loading CSS dependencies: ${styles}`);

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
          console.log(`Loaded ${this.href}`);
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
    console.log('Loading JS dependencies');
    const { loadJS } = WebRenderer;
    return loadJS(
      [...this.jsDependencies()],
    );
  }

  static loadJS(scriptList, timeout = 5000) {
    const { loadedScripts } = WebRenderer;

    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      const loaded = [];
      let scripts = scriptList;
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
          console.log(`Loaded ${this.src}`);
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
