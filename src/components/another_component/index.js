/* eslint-disable class-methods-use-this */
/* eslint-disable no-undef */

class AnotherComponent extends BaseComponent {
  createPerson() {
    const input = {
      f: {
        g: {
          h: {
            i: [
              {
                k: 'assumenda',
              },
            ],
          },
        },
      },
      people: [
        {
          person: {
            name: 'vero',
            gender: 'odit',
            birthYear: 9,
          },
        },
      ],
      users: [
        {
          books: [
            {
              name: 'beatae',
              authors: [
                'ea',
              ],
              releaseYear: 9,
            },
          ],
          id: 10,
        },
      ],
      a: {
        b: 'beatae',
      },
      multi: [
        [
          {
            x: [
              [
                'illum',
                'vitae',
                'cumque',
                'voluptate',
                'maxime',
                'sapiente',
              ],
              [
                'fugiat',
                'aut',
                'officiis',
                'quis',
                'eius',
                'debitis',
              ],
              [
                'totam',
                'omnis',
                'culpa',
                'voluptatum',
                'voluptatem',
                'ut',
              ],
              [
                'repellat',
                'ut',
                'magnam',
                'architecto',
                'hic',
                'ratione',
              ],
              [
                'eligendi',
                'voluptatem',
                'quo',
                'ut',
                'officia',
                'porro',
              ],
              [
                'nemo',
                'sed',
                'asperiores',
                'aliquid',
                'neque',
                'adipisci',
              ],
              [
                'ut',
                'iure',
                'assumenda',
                'iure',
                'dicta',
                'minima',
              ],
              [
                'dolor',
                'natus',
                'corporis',
                'nihil',
                'est',
                'nam',
              ],
            ],
          },
          {
            x: [
              [
                'enim',
                'sed',
                'dolor',
                'repellat',
                'est',
                'aperiam',
              ],
              [
                'quod',
                'voluptates',
                'minus',
                'et',
                'esse',
                'cupiditate',
              ],
              [
                'mollitia',
                'exercitationem',
                'laborum',
                'quod',
                'quae',
                'eaque',
              ],
              [
                'accusantium',
                'animi',
                'debitis',
                'totam',
                'aut',
                'rerum',
              ],
              [
                'vel',
                'ex',
                'sed',
                'voluptatem',
                'explicabo',
                'tenetur',
              ],
              [
                'maxime',
                'occaecati',
                'nemo',
                'assumenda',
                'magni',
                'porro',
              ],
              [
                'totam',
                'praesentium',
                'quae',
                'odio',
                'hic',
                'repellendus',
              ],
              [
                'ab',
                'id',
                'debitis',
                'ipsum',
                'quia',
                'voluptatibus',
              ],
            ],
          },
        ],
      ],
    };
    console.info('createPerson');
    return new components.SampleComponent({
      input,
    });
  }

  createText() {
    return 'createText';
  }

  loadingStrategy() {
    return BaseComponent.ASYNC_LOADING_STRATEGY;
  }

  // In server mode, for a component render in js, how do we
  // resolve this.getInput() which is obviously null at the time

  // Ensure unique class names per component

  // Figure out XHR requests / custom blocks

  myMethod(options) {
    const { hash: { ctx } } = options;
    return 'Yello!';
  }
}

module.exports = AnotherComponent;
