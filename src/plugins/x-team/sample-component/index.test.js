/* eslint-disable class-methods-use-this */
const faker = require('faker');
const Antelope = require('./index');

/**
 *  Test implementation of the actual component class. All methods defined here
 *  should return mock data instead of real data. Note: all overriding methods should not
 *  accept arguments, and the data returned should have the same type with the
 *  one from the actual class
 */
class AntelopeTest extends Antelope {
  echo() {
    return JSON.stringify({ key: faker.lorem.words() });
  }

  capitalize() {
    return faker.lorem.words().toUpperCase();
  }

  // eslint-disable-next-line no-underscore-dangle
  _capitalize() {
    return faker.lorem.words().toUpperCase();
  }

  sayHello() {
    const name = faker.name.firstName();
    const age = faker.random.number();
    return `Hello ${name}. You are ${age} years old`;
  }

  getRandomArbitrary(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
  }

  getAge() {
    return 2020 - this.getRandomArbitrary(1970, 2010);
  }

  createPerson() {
    return 'Hey!';
  }
}
module.exports = AntelopeTest;
