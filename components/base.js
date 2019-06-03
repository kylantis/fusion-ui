class BaseComponent {

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



  getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}