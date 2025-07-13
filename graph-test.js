// @ts-check

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
  return new Promise((resolve, reject) => {
    const messageHandler = (/** @type {{ data: { type: string; payload: any; }; }} */ e) => {
      const { type, payload } = e.data;
      // We only care about the response to our specific request.
      // TODO: More robust is to pass an id into the message and wait for that id in the response.
      if (type === 'getComponentsInBuildOrder') {
        graph.removeEventListener('message', messageHandler); // Detach handler
        resolve(payload.componentNames);
      }
    }
    graph.addEventListener('message', messageHandler);
    graph.postMessage({ type: 'getComponentsInBuildOrder' });
  });
}

/**
 * 
 * @param {Worker!} graph 
 * @param {string!} name 
 * @returns {Promise<{values: Float32Array!, gradients: Float32Array!}>}
 */
async function getValues(graph, name) {
  return new Promise((resolve, reject) => {
    const messageHandler = (/** @type {{ data: { type: string; payload: any; }; }} */ e) => {
      const { type, payload } = e.data;
      // We only care about the response to our specific request.
      // TODO: More robust is to pass an id into the message and wait for that id in the response.
      if (type === 'getValues') {
        graph.removeEventListener('message', messageHandler); // Detach handler
        resolve(payload);
      }
    }
    graph.addEventListener('message', messageHandler);
    graph.postMessage({ type: 'getValues', payload: { name } });
  });
}
/**
 * 
 * @param {Worker} graph 
 * @returns {Promise<void>}
 */
async function waitForReady(graph) {
  return new Promise((resolve, reject) => {
    const messageHandler = (/** @type {{ data: { type: string; payload: any; }; }} */ e) => {
      const { type, payload } = e.data;
      // We only care about the response to our specific request.
      // TODO: More robust is to pass an id into the message and wait for that id in the response.
      if (type === 'ready') {
        graph.removeEventListener('message', messageHandler); // Detach handler
        console.log('Worker is ready.');
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
  return new Promise((resolve, reject) => {
    const messageHandler = (/** @type {{ data: { type: string; payload: any; }; }} */ e) => {
      const { type } = e.data;
      // We only care about the response to our specific request.
      // TODO: More robust is to pass an id into the message and wait for that id in the response.
      if (type === 'finish') {
        graph.removeEventListener('message', messageHandler); // Detach handler
        console.log('Worker finished.');
        resolve();
      }
    }
    graph.addEventListener('message', messageHandler);
    graph.postMessage({ type: 'finish' });
  });
}

async function displayAllNodes(graph) {
  const d = document.getElementById('output');
  if (!d) { throw new Error('Output div not found.') }
  d.innerHTML = '';

  const components = await getComponentsInBuildOrder(graph);
  for (const component of components) {
    console.log(component);
    if (component.type === 'node') {
      await addNodeInfo(graph, component.name, d);
    }
  }
}

async function addNodeInfo(graph, nodeName, container) {
  const { values, gradients } = await getValues(graph, nodeName);
  const d = document.createElement('div');
  d.classList.add('node');
  d.innerText = nodeName + ':\nValues' + JSON.stringify(values) + '\nGradients' + JSON.stringify(gradients) + '\n\n';
  container.appendChild(d);
}

async function init() {
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
      name: 'X', values: [  // 2x4
        0, 1, 0, 1, // row 1
        0, 0, 1, 1] // row 2
    }
  });

  createNode(graph, 'Expected', { height: batchSize, width: outputSize, nodeType: 'output' });
  graph.postMessage({
    type: 'setValues', payload: { name: 'Expected', values: [0, 1, 1, 0] }
  });


  loss(graph, { actual: 'Y', expected: 'Expected' });

  graph.postMessage({ type: 'forward' });
  graph.postMessage({ type: 'backwardAndAddGradient', payload: { learningRate: 0.05 } });

  {
    const { values, gradients } = await getValues(graph, 'Y');
    console.log('Values:', values);
    console.log('Gradients:', gradients);
  }

  await displayAllNodes(graph);


  {
    const { values, gradients } = await getValues(graph, 'Y');
    console.log('Values:', values);
    console.log('Gradients:', gradients);
  }
  {
    const { values, gradients } = await getValues(graph, 'Expected');
    console.log('Values:', values);
    console.log('Gradients:', gradients);
  }
}

document.addEventListener('DOMContentLoaded', () => { init(); });