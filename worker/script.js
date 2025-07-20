// @ts-check

import { Gpu } from '../gpu.js';
import { Graph, Node } from '../graph.js';
/** @typedef {import('./api.js').WorkerRequest} WorkerRequest */
/** @typedef {import('./api.js').ComponentDescription} ComponentDescription */

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

self.onmessage = (/** @type {MessageEvent<WorkerRequest>} */ e) => {
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
    const nodeMap = graph.nodeMap;  /** @type {Map<string, Node>} */
    if (payload && payload.name) {
      node = nodeMap.get(payload.name);
    }
    // if (node) {
    //   console.log(`Command ${type} received for node ${node.name}`)
    // } else {
    //   console.log(`Command ${type} received.`);
    // }
    const requestId = (e.data && e.data.requestId) ? e.data.requestId : undefined;
    switch (type) {
      case 'createNode': {
        graph.createNode(payload.name, payload.spec, payload.initialization);
        break;
      }
      case 'multiply': {
        graph.multiply(payload);
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
      case 'calculateGradient':
        graph.calculateGradient();
        break;
      case 'applyGradient':
        graph.applyGradient(payload.learningRate);
        break;
      case 'loss':
        graph.loss(payload);
        break;
      case 'relu':
        graph.relu(payload);
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
        // console.log(`Responding on request Id ${requestId} with ${componentNames.length} components.`);
        self.postMessage({ type: 'getComponentsInBuildOrder', payload: { componentNames }, requestId });
        break;
      case 'getValues':
        if (!node) {
          throw new Error(`Node with name ${payload.name} not found.`);
        }
        const values = node.value.getValues();
        const gradients = node.gradient.getValues();
        // console.log('Values:', values);
        // console.log('Gradients:', gradients);
        self.postMessage(
          { type: 'getValues', payload: { values, gradients }, requestId },
          [values.buffer, gradients.buffer]);
        break;
      case 'getSpec':
        if (!node) {
          throw new Error(`Node with name ${payload.name} not found.`);
        }
        const spec = node.spec;
        self.postMessage(
          { type: 'getSpec', payload: { spec }, requestId }
          // No need to transfer spec since it's just an object.
        );
        break;
      case 'finish':
        gpu.context.gl.finish();
        self.postMessage({ type: 'finish', requestId });
        break;

      default:
        console.warn(`Unknown message type received in worker: ${type}`);
        self.postMessage({ type: 'error', payload: { message: `Unknown command: ${type}` }, requestId });
        failed = true;
    }
    if (!failed) {
      self.postMessage({ type: 'done', payload: { type }, requestId });
    }

  } catch (error) {
    console.error(`Error processing message type ${type}:`, error);
    self.postMessage({ type: 'error', payload: { message: error.message, command: type } });
  }
};

// Start the initialization process.
init();

// TODO: after enqueing a whole bunch of forward/backward passes, we can call gl.finish() in the worker to block
// until computations are done.  We might want to implement 'finish' as a message and reply when it is done.

// TODO: Consider some option for measuring performance by putting start/stop messages into the render queue
/*
// Check if the extension is available
const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');

if (ext) {
    const query = gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);

    // Your WebGL computation commands here
    gl.drawArrays(gl.TRIANGLES, 0, 6); // Example computation

    gl.endQuery(ext.TIME_ELAPSED_EXT);

    // Check the query result later (asynchronously)
    const checkQuery = () => {
        const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
        if (available) {
            const elapsedNanos = gl.getQueryParameter(query, gl.QUERY_RESULT);
            const elapsedMillis = elapsedNanos / 1_000_000;
            console.log(`GPU computation took: ${elapsedMillis.toFixed(2)} ms`);
            gl.deleteQuery(query);
        } else {
            requestAnimationFrame(checkQuery); // Or setTimeout/setInterval
        }
    };
    requestAnimationFrame(checkQuery);
} else {
    console.warn('EXT_disjoint_timer_query_webgl2 not supported.');
}

*/
