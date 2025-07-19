
// @ts-check

import { TextMatrix } from '../text-matrix.js';
/** @typedef {import('./api.js').MatrixSpec} MatrixSpec */

export class GraphClient {
  constructor(graphWorker) {
    this.graph = graphWorker;
    this.uid = 1;
    this.textMatrixMap = new Map();
  }

  static async create() {
    const graph = new Worker('worker/script.js', { type: 'module' });
    const g = new GraphClient(graph);
    await g.waitForReady();
    return g;
  }

  postMessage(message) {
    this.graph.postMessage(message);
  }

  /**
   * 
   * @param {string!} name 
   * @param {MatrixSpec!} spec 
   */
  createNode(name, spec) {
    this.graph.postMessage({
      type: 'createNode',
      payload: { name, spec }
    });
  }

  multiply({ x, w, y }) {
    this.graph.postMessage({
      type: 'multiply',
      payload: { x, w, y }
    });
  }

  multiplyAdd({ x, w, b, y }) {
    this.graph.postMessage({
      type: 'multiplyAdd',
      payload: { x, w, b, y }
    });
  }

  loss({ actual, expected }) {
    this.graph.postMessage({
      type: 'loss',
      payload: { actual, expected }
    });
  }

  async getComponentsInBuildOrder() {
    const expectedRequestId = this.uid++;
    return new Promise((resolve, reject) => {
      const messageHandler = (/** @type {{ data: { type: string; payload: any; requestId: number}; }} */ e) => {
        const { type, payload, requestId } = e.data;
        if (type === 'getComponentsInBuildOrder' && requestId === expectedRequestId) {
          resolve(payload.componentNames);
        }
      }
      this.graph.addEventListener('message', messageHandler);
      this.graph.postMessage({ type: 'getComponentsInBuildOrder', requestId: expectedRequestId });
    });
  }

  async getValues(name) {
    const expectedRequestId = this.uid++;
    return new Promise((resolve, reject) => {
      const messageHandler = (/** @type {{ data: { type: string; payload: any; requestId: number}; }} */ e) => {
        const { type, payload, requestId } = e.data;
        if (type === 'getValues' && requestId === expectedRequestId) {
          resolve(payload);
        }
      }
      this.graph.addEventListener('message', messageHandler);
      this.graph.postMessage({ type: 'getValues', payload: { name }, requestId: expectedRequestId });
    });
  }

  /**
   * 
   * @param {string!} name 
   * @returns {Promise<MatrixSpec!>}
   */
  async getSpec(name) {
    const expectedRequestId = this.uid++;
    return new Promise((resolve, reject) => {
      const messageHandler = (/** @type {{ data: { type: string; payload: any; requestId: number}; }} */ e) => {
        const { type, payload, requestId } = e.data;
        if (type === 'getSpec' && requestId === expectedRequestId) {
          resolve(payload.spec);
        }
      }
      this.graph.addEventListener('message', messageHandler);
      this.graph.postMessage({ type: 'getSpec', payload: { name }, requestId: expectedRequestId });
    });
  }

  /**
   * 
   * @returns {Promise<void>}
   */
  async waitForReady() {
    return new Promise((resolve, reject) => {
      const messageHandler = (/** @type {{ data: { type: string; payload: any; requestId: number}; }} */ e) => {
        const { type } = e.data;
        if (type === 'ready') {
          console.log('Ready!');
          resolve();
        }
      }
      this.graph.addEventListener('message', messageHandler);
    });
  }

  /**
   * 
   * @returns {Promise<void>}
   */
  async finish() {
    const expectedRequestId = this.uid++;
    return new Promise((resolve, reject) => {
      const messageHandler = (/** @type {{ data: { type: string; payload: any; requestId: number}; }} */ e) => {
        const { type, payload, requestId } = e.data;
        if (type === 'finish' && requestId === expectedRequestId) {
          resolve();
        }
      }
      this.graph.addEventListener('message', messageHandler);
      this.graph.postMessage({ type: 'finish', requestId: expectedRequestId });
    });
  }


  async displayAllNodes() {
    const d = document.getElementById('output');
    if (!d) {
      throw new Error('Output div not found.');
    }
    const components = await this.getComponentsInBuildOrder();
    for (const component of components) {
      if (component.type === 'node') {
        // console.log(`Display node: ${component.name}`);
        await this.addNodeInfo(component.name, d);
      }
    }
  }

  async addNodeInfo(nodeName, container) {
    let textMatrix = this.textMatrixMap.get(nodeName);
    if (!textMatrix) {
      const spec = await this.getSpec(nodeName);
      textMatrix = new TextMatrix(nodeName, spec);
      this.textMatrixMap.set(nodeName, textMatrix);
      container.appendChild(textMatrix.div);
    }
    const { values, gradients } = await this.getValues(nodeName);
    // console.log(`Updating node: ${nodeName}`);
    // console.log('Values:', values);
    // console.log('Gradients:', gradients);
    textMatrix.update(values, gradients);
    return;
  }

  async runForward() {
    this.graph.postMessage({ type: 'forward' });
    await this.finish();
    await this.displayAllNodes();
  }
  async calculateGradients() {
    this.graph.postMessage({ type: 'calculateGradient', payload: {} });
    await this.finish();
    await this.displayAllNodes();
  }
  async applyGradients() {
    this.graph.postMessage({ type: 'applyGradient', payload: { learningRate: 0.05 } });
    this.finish();
    await this.displayAllNodes();
  }

  async runX(n) {
    for (let i = 0; i < n; i++) {
      this.graph.postMessage({ type: 'forward' });
      this.graph.postMessage({ type: 'backwardAndAddGradient', payload: { learningRate: 0.05 } });
    }
    await this.finish();
    await this.displayAllNodes();
  }

}