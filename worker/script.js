// @ts-check

import { Gpu } from '../gpu.js';
import { Graph, Node } from '../graph.js';

/** @type {Gpu | null} */
let gpu = null;
/** @type {Graph | null} */
let graph = null;

/**
 * Initializes the GPU and the graph.
 */
async function init() {
  try {
    gpu = await Gpu.create();
    graph = new Graph(gpu);
    self.postMessage({ type: 'ready' });
    console.log('Worker initialized.');
  } catch (error) {
    console.error('Worker initialization failed:', error);
    self.postMessage({ type: 'error', payload: { message: error.message } });
  }
}

self.onmessage = (/** @type {{ data: { type: string!; payload: any; }; }} */ e) => {
  if (!gpu || !graph) {
    // This could happen if a message is sent before 'init' completes.
    // A robust implementation might queue messages, but for now, we'll just error.
    self.postMessage({ type: 'error', payload: { message: 'Worker not ready.' } });
    console.error('Worker not ready to handle messages.');
    return;
  }

  const { type, payload } = e.data;

  try {
    let failed = false;
    /** @type {Node! | null} */
    let node = null;
    if (payload && payload.name) {
      console.log('Received message: ', type, ' ', payload.name);
      node = graph.nodeMap.get(payload.name);
    }
    switch (type) {
      case 'createNode': {
        graph.createNode(payload.name, payload.spec);
        break;
      }
      case 'multiplyAdd': {
        graph.multiplyAdd(payload);
        break;
      }
      case 'forward':
        graph.forward();
        break;
      case 'backwardAndAddGradient':
        graph.backwardAndAddGradient(payload.learningRate);
        break;
      case 'loss':
        graph.loss(payload);
        break;
      case 'setValues':
        if (!node) {
          throw new Error(`Node with name ${payload.name} not found.`);
        }
        console.log('Setting values:', payload.values);
        node.value.setValues(payload.values);
        break;
      case 'getComponentsInBuildOrder':
        const components = graph.getComponentsInBuildOrder();
        const componentNames = [];
        for (const component of components) {
          componentNames.push(component.getDescription());
        }
        self.postMessage({ type: 'getComponentsInBuildOrder', payload: { componentNames } });
        break;
      case 'getValues':
        if (!node) {
          throw new Error(`Node with name ${payload.name} not found.`);
        }
        const values = node.value.getValues();
        const gradients = node.gradient.getValues();
        console.log('Values:', values);
        console.log('Gradients:', gradients);
        self.postMessage(
          { type: 'getValues', payload: { values, gradients } },
          [values.buffer, gradients.buffer]);
        break;

      default:
        console.warn(`Unknown message type received in worker: ${type}`);
        self.postMessage({ type: 'error', payload: { message: `Unknown command: ${type}` } });
        failed = true;
    }
    if (!failed) {
      self.postMessage({ type: 'done', payload: { type } });
    }

  } catch (error) {
    console.error(`Error processing message type ${type}:`, error);
    self.postMessage({ type: 'error', payload: { message: error.message, command: type } });
  }
};

// Start the initialization process.
init();
