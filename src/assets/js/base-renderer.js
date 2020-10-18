
/* eslint-disable class-methods-use-this */
class BaseRenderer {
  static #componentIds = [];

 #id;

 #input;

 #loadable;

 #isRoot;

 constructor({
   id,
   input,
   loadable = true,
 } = {}) {
   if (!id) {
     // eslint-disable-next-line no-param-reassign
     id = this.generateComponentId();
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
   this.logger = console;
   this.#input = input;
   this.#loadable = loadable;
   this.#isRoot = !BaseRenderer.#componentIds.length;

   if (this.#loadable) {
     BaseRenderer.#componentIds.push(this.#id);
   }

   // Create root proxy
   // eslint-disable-next-line no-undef
   RootProxy.create({ component: this });
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
   return this.resolver ? this.resolver : this.#input;
 }

 load() {
 }

 generateComponentId() {
   return `${this.constructor.name}-${BaseRenderer.generateRandomString()}`;
 }

 static generateRandomString() {
   const length = 8;
   let result = '';
   const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
   const charactersLength = characters.length;
   // eslint-disable-next-line no-plusplus
   for (let i = 0; i < length; i++) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
 }
}
module.exports = BaseRenderer;
