

class BaseComponent {

  constructor(data, node) {
    this.data = data;
    this.node = node || document.body;
    this.loadDependencies().then(() => {
      this.render();
    });
  }

  tagName() {
    return null;
  }
  getCssDependencies() {
    return ['/shared/css/site.css', '/shared/css/reset.css'];
  }

  getJsDependencies() {
    return ['/shared/js/jquery-3.4.1.min.js'];
  }

  getComponent(tag, node, data) {

  }

  loadDependencies() {
    return Promise.all([
      this.loadCSSDependencies(),
      this.loadJSDependencies()
    ]);
  }

  loadCSSDependencies(timeout = 5000) {

    console.log('Loading CSS dependencies');

    return new Promise((resolve, reject) => {

      const loaded = [];
      let styles = this.getCssDependencies();

      // Filter styles that have previously loaded
      styles = styles.filter(style => !BaseComponent.loadedStyles.includes(style));

      if (!styles.length) {
        return resolve([]);
      }

      for (const url of styles) {

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.type = 'text/css';
        link.async = false;

        link.onload = function () {

          console.log(`Loaded ${this.href}`);

          loaded.push(this.href);
          BaseComponent.loadedStyles.push(this.href);

          if (loaded.length == styles.length) {
            return resolve();
          }
        };

        link.onerror = function () {
          return reject(this.href);
        }

        document.head.appendChild(link);
      }

      setTimeout(function () {
        if (loaded.length < styles.length) {
          return reject(styles[loaded.length].url);
        }
      }, timeout);

    });
  }

  loadJSDependencies(timeout = 5000) {

    console.log('Loading JS dependencies');

    return new Promise((resolve, reject) => {
      
      const loaded = [];
      let scripts = this.getJsDependencies();

      // Objectify string entries
      scripts = scripts.map(script =>
        script.constructor.name == 'String' ? {
          url: script
        } : script
      );

      // Filter scripts that have previously loaded
      scripts = scripts.filter(script => !BaseComponent.loadedScripts.includes(script.url));

      if (!scripts.length) {
        return resolve([]);
      }

      for (const elem of scripts) {

        var script = document.createElement('script');

        script.src = elem.url;
        script.async = false;

        script.onload = function () {

          console.log(`Loaded ${this.src}`);

          loaded.push(this.src);
          BaseComponent.loadedScripts.push(this.src);

          if (elem.onload) {
            eval(elem.onload);
          }

          if (loaded.length == scripts.length) {
            return resolve();
          }
        };

        script.onerror = function () {
          return reject(this.src);
        }

        document.head.appendChild(script);
      };

      setTimeout(function () {
        if (loaded.length < scripts.length) {
          return reject(scripts[loaded.length].url);
        }
      }, timeout);

    });
  }

  getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

BaseComponent.loadedStyles = [];
BaseComponent.loadedScripts = [];