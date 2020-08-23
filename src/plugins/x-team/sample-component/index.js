/* eslint-disable class-methods-use-this */
/* eslint-disable no-undef */

class Antelope extends BaseComponent {
  echo(object) {
    return JSON.stringify(object);
  }

  capitalize(name) {
    const c = 'Hello';
    return c.toUpperCase();
  }

  // eslint-disable-next-line no-underscore-dangle
  _capitalize(name) {
    return name.toUpperCase();
  }

  sayHello(name, age) {
    return `Hello ${name}. You are ${age} years old`;
  }

  // eslint-disable-next-line no-unused-vars
  dynamicUsers(people) {
    return [
      {
        id: 1234,
        books: [
          {
            name: 'Angels and Demons',
            releaseYear: 1994,
            authors: ['John Kelly', 'Amber Rose'],
          },
          {
            name: 'The Red man',
            releaseYear: 1994,
            authors: ['Peter Clinch', 'James Ivy'],
          },
        ],
      },
      {
        id: 5678,
        books: [
          {
            name: 'Co and Theirs',
            releaseYear: 2005,
            authors: ['Abnel Loka', 'Jiji Kuku'],
          },
          {
            name: 'Live Trail',
            releaseYear: 2007,
            authors: ['Joe Poe', 'Isa Delaware'],
          },
        ],
      },
      {
        id: 8265,
        books: [
          {
            name: 'Girls and Buys',
            releaseYear: 1245,
            authors: ['Jogn Bol', 'Koko Haj'],
          },
          {
            name: 'Mirange',
            releaseYear: 2000,
            authors: ['James Edward', 'Peter Tucker'],
          },
        ],
      },
    ];
  }

  /**
     * Synthetic Method
     */
  getAge(year) {
    return 2020 - year;
  }

  createPerson() {
  }
}

module.exports = Antelope;
