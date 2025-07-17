// @ts-check

import { TextMatrix } from './text-matrix.js';

let uid = 1;

/**
 * 
 * @param {Worker} graph 
 * @param {string} name 
 * @param {Object!} spec 
 */
function createNode(graph, name, spec) {
  graph.postMessage({
    type: 'createNode',
    payload: { name, spec }
  });
}

/**
 * 
 * @param {Worker} graph 
 * @param {string} x 
 * @param {string} w 
 * @param {string} b 
 * @param {string} y 
 */
function multiplyAdd(graph, x, w, b, y) {
  graph.postMessage({
    type: 'multiplyAdd',
    payload: { x, w, b, y }
  });
}

function loss(graph, { actual, expected }) {
  graph.postMessage({
    type: 'loss',
    payload: { actual, expected }
  });
}

async function getComponentsInBuildOrder(graph) {
  const expectedRequestId = uid++;
  return new Promise((resolve, reject) => {
    const messageHandler = (/** @type {{ data: { type: string; payload: any; requestId: number}; }} */ e) => {
      const { type, payload, requestId } = e.data;
      // We only care about the response to our specific request.
      // TODO: More robust is to pass an id into the message and wait for that id in the response.
      if (type === 'getComponentsInBuildOrder' && requestId === expectedRequestId) {
        resolve(payload.componentNames);
      }
    }
    graph.addEventListener('message', messageHandler);
    graph.postMessage({ type: 'getComponentsInBuildOrder', requestId: expectedRequestId });
  });
}

/**
 * 
 * @param {Worker!} graph 
 * @param {string!} name 
 * @returns {Promise<{values: Float32Array!, gradients: Float32Array!}>}
 */
async function getValues(graph, name) {
  const expectedRequestId = uid++;
  return new Promise((resolve, reject) => {
    const messageHandler = (/** @type {{ data: { type: string; payload: any; requestId: number}; }} */ e) => {
      const { type, payload, requestId } = e.data;
      if (type === 'getValues' && requestId === expectedRequestId) {
        resolve(payload);
      }
    }
    graph.addEventListener('message', messageHandler);
    graph.postMessage({ type: 'getValues', payload: { name }, requestId: expectedRequestId });
  });
}

/**
 * 
 */
async function getSpec(graph, name) {
  const expectedRequestId = uid++;
  return new Promise((resolve, reject) => {
    const messageHandler = (/** @type {{ data: { type: string; payload: any; requestId: number}; }} */ e) => {
      const { type, payload, requestId } = e.data;
      if (type === 'getSpec' && requestId === expectedRequestId) {
        resolve(payload.spec);
      }
    }
    graph.addEventListener('message', messageHandler);
    graph.postMessage({ type: 'getSpec', payload: { name }, requestId: expectedRequestId });
  });
}

/**
 * 
 * @param {Worker} graph 
 * @returns {Promise<void>}
 */
async function waitForReady(graph) {
  // waitForReady does not post a message and needs no requestId.
  return new Promise((resolve, reject) => {
    const messageHandler = (/** @type {{ data: { type: string; payload: any; requestId: number}; }} */ e) => {
      const { type } = e.data;
      if (type === 'ready') {
        console.log('Ready!');
        resolve();
      }
    }
    graph.addEventListener('message', messageHandler);
  });
}

/**
 * 
 * @param {Worker} graph 
 * @returns {Promise<void>}
 */
async function finish(graph) {
  const expectedRequestId = uid++;
  return new Promise((resolve, reject) => {
    const messageHandler = (/** @type {{ data: { type: string; payload: any; requestId: number}; }} */ e) => {
      const { type, payload, requestId } = e.data;
      if (type === 'finish' && requestId === expectedRequestId) {
        resolve();
      }
    }
    graph.addEventListener('message', messageHandler);
    graph.postMessage({ type: 'finish', requestId: expectedRequestId });
  });
}

async function displayAllNodes(graph) {
  const d = document.getElementById('output');
  if (!d) {
    throw new Error('Output div not found.');
  }
  const components = await getComponentsInBuildOrder(graph);
  for (const component of components) {
    if (component.type === 'node') {
      await addNodeInfo(graph, component.name, d);
    }
  }
}

const textMatrixMap = new Map();
async function addNodeInfo(graph, nodeName, container) {
  let textMatrix = textMatrixMap.get(nodeName);
  if (!textMatrix) {
    const spec = await getSpec(graph, nodeName);
    textMatrix = new TextMatrix(nodeName, spec);
    textMatrixMap.set(nodeName, textMatrix);
    container.appendChild(textMatrix.div);
  }
  const { values, gradients } = await getValues(graph, nodeName);
  textMatrix.update(values, gradients);
  return;
}

class GraphTest {
  constructor() {
    this.init();
  }

  async init() {
    console.log('Initializing...');
    const graph = new Worker('worker/script.js', { type: 'module' });
    await waitForReady(graph);

    console.log('Constructing graph...');

    // Construct a simple two-layer net.

    // Y1 = W1 X + B1
    // Y = W2 Y1 + B2

    const batchSize = 4;
    const inputSize = 2;  // 2 values per sample
    const hiddenSize = 3;
    const outputSize = 1;  // 1 value per output

    createNode(graph, 'X', { height: batchSize, width: inputSize, nodeType: 'input' });
    createNode(graph, 'W1', { height: inputSize, width: hiddenSize, nodeType: 'train' });
    createNode(graph, 'B1', { height: 1, width: hiddenSize, nodeType: 'train' });
    createNode(graph, 'Y1', { height: batchSize, width: hiddenSize, nodeType: 'intermediate' });

    multiplyAdd(graph, 'X', 'W1', 'B1', 'Y1');

    createNode(graph, 'R1', { height: batchSize, width: hiddenSize, nodeType: 'intermediate' });
    graph.postMessage({ type: 'relu', payload: { x: 'Y1', y: 'R1' } });

    createNode(graph, 'W2', { height: hiddenSize, width: outputSize, nodeType: 'train' });
    createNode(graph, 'B2', { height: outputSize, width: 1, nodeType: 'train' });
    createNode(graph, 'Y2', { height: batchSize, width: outputSize, nodeType: 'intermediate' });

    multiplyAdd(graph, 'Y1', 'W2', 'B2', 'Y2');
    createNode(graph, 'Y', { height: batchSize, width: outputSize, nodeType: 'output' });
    graph.postMessage({ type: 'relu', payload: { x: 'Y2', y: 'Y' } });

    graph.postMessage({
      type: 'setValues', payload: {
        name: 'X', values: [  // 4x2
          0, 0,
          0, 1,
          1, 0,
          1, 1]
      }
    });

    createNode(graph, 'Expected', { height: batchSize, width: outputSize, nodeType: 'output' });
    graph.postMessage({
      type: 'setValues', payload: { name: 'Expected', values: [0, 1, 1, 0] }
    });


    loss(graph, { actual: 'Y', expected: 'Expected' });

    this.graph = graph;
    {
      const b = document.createElement('button');
      b.innerText = 'Forward';
      b.onclick = this.runForward.bind(this);
      document.body.appendChild(b);
    }
    {
      const b = document.createElement('button');
      b.innerText = 'Backward';
      b.onclick = this.runBackward.bind(this);
      document.body.appendChild(b);
    }
    this.run();
  }

  async run() {
    await this.runForward();
    await this.runBackward();
  }
  async runForward() {
    const graph = this.graph;
    if (!graph) {
      throw new Error('Graph worker not initialized.');
    }
    graph.postMessage({ type: 'forward' });
    finish(graph);

    await displayAllNodes(graph);
  }
  async runBackward() {
    const graph = this.graph;
    if (!graph) {
      throw new Error('Graph worker not initialized.');
    }
    graph.postMessage({ type: 'backwardAndAddGradient', payload: { learningRate: 0.05 } });
    finish(graph);

    await displayAllNodes(graph);
  }

}

async function init() {
  new GraphTest();
}


document.addEventListener('DOMContentLoaded', () => { init(); });