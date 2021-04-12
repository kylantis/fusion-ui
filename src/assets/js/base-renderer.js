
/* eslint-disable class-methods-use-this */
class BaseRenderer {
  static #componentIds = [];

 #id;

 #input;

 #loadable;

 #isRoot;

 #initialized;

 constructor({ id, input, loadable = true, logger } = {}) {
   if (!id) {
     // eslint-disable-next-line no-param-reassign
     id = this.#createId();
   }

   // eslint-disable-next-line no-undef
   assert(id && id.constructor.name === 'String');
   // eslint-disable-next-line no-undef
   assert(input && input.constructor.name === 'Object');

   // eslint-disable-next-line no-undef
   assert(
     !BaseRenderer.#componentIds.includes(id),
     `Duplicate componentId: ${id}`,
   );

   this.#id = id;
   this.logger = logger || console;
   this.#input = input;
   this.#loadable = loadable;
   this.#isRoot = !BaseRenderer.#componentIds.length;

   if (this.#loadable) {
     BaseRenderer.#componentIds.push(this.#id);
   }

   if (global.isServer && global.isWatch && this.#loadable) {
    throw Error();
   }

   // Create root proxy
   // eslint-disable-next-line no-undef
   RootProxy.create(this);

   this.#initialized = true;
 }

 static getComponentIds() {
   return BaseRenderer.#componentIds;
 }

 loadable() {
   return this.#loadable;
 }

 isRoot() {
   return this.#isRoot;
 }

 getId() {
   return this.#id;
 }

 getInput() {
   return this.#input;
 }

 setInput(input) {
   if (this.#initialized) {
    throw Error(`[${this.#id}] The root object cannot be modified`);
   }
  this.#input = input;
}

isInitialized() {
  return this.#initialized;
}

 load() {
 }

 toJSON() {
   const o = {};
   o['@type'] = this.constructor.className || this.constructor.name;
   o['@data'] = this.#input;
   return o;
 }

 #createId() {
   return `${this.constructor.name}-${global.clientUtils.randomString()}`;
 }
}
module.exports = BaseRenderer;
