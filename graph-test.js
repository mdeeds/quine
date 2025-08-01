// @ts-check

import { GraphClient } from './worker/client.js';


/**
 * @param {GraphClient!} graph;
 */
async function buildValueGraph(graph) {
  // Constructs the simplest graph - just a trainable output and expected value.

  graph.createNode('X', { height: 6, width: 1, nodeType: 'train' });
  graph.createNode('Y', { height: 6, width: 1, nodeType: 'output' });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'X', values: [-1, 2, -3, 4, -5, 6]
    }
  });

  graph.postMessage({
    type: 'setValues', payload: {
      name: 'Y', values: [6, 5, 4, 3, 2, 1]
    }
  });
  graph.loss({ actual: 'X', expected: 'Y' });
}

async function buildReluGraph(graph) {
  graph.createNode('X', { height: 6, width: 1, nodeType: 'train' });
  graph.createNode('Y', { height: 6, width: 1, nodeType: 'intermediate' })
  graph.postMessage({ type: 'relu', payload: { x: 'X', y: 'Y' } });
  graph.createNode('E', { height: 6, width: 1, nodeType: 'output' });

  graph.postMessage({
    type: 'setValues', payload: {
      name: 'X', values: [2.0, 2.0, 2.0, 2.0, 2.0, -1.0]
    }
  });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'E', values: [0.0, 0.0, 0.1, 0.2, 0.3, 0.4]
    }
  });
  graph.loss({ actual: 'Y', expected: 'E' });
}

/**
 * @param {GraphClient!} graph;
 */
async function buildIdentityGraph(graph) {
  // Constructs the simplest graph - just a trainable output and expected value.

  graph.createNode('X', { height: 3, width: 2, nodeType: 'input' });
  graph.createNode('W', { height: 2, width: 2, nodeType: 'train' });

  graph.createNode('Y', { height: 3, width: 2, nodeType: 'output' });
  graph.multiply({ x: 'X', w: 'W', y: 'Y' })

  graph.postMessage({
    type: 'setValues', payload: {
      name: 'X', values: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
    }
  });
  graph.createNode('E', { height: 3, width: 2, nodeType: 'output' });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'E', values: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
    }
  });
  graph.loss({ actual: 'Y', expected: 'E' });
}

async function buildXorGraph(graph) {
  // Construct a simple two-layer net.

  // Y1 = W1 X + B1
  // Y = W2 Y1 + B2

  const batchSize = 4;
  const inputSize = 2;  // 2 values per sample
  const hiddenSize = 4;
  const outputSize = 1;  // 1 value per output

  graph.createNode('X', { height: batchSize, width: inputSize, nodeType: 'input' });
  graph.createNode('W1', { height: inputSize, width: hiddenSize, nodeType: 'train' }, 'random');
  graph.createNode('B1', { height: 1, width: hiddenSize, nodeType: 'train' }, 'random');
  graph.createNode('Y1', { height: batchSize, width: hiddenSize, nodeType: 'intermediate' });

  graph.multiplyAdd({ x: 'X', w: 'W1', b: 'B1', y: 'Y1' });

  graph.createNode('R1', { height: batchSize, width: hiddenSize, nodeType: 'intermediate' });
  graph.postMessage({ type: 'relu', payload: { x: 'Y1', y: 'R1' } });

  graph.createNode('W2', { height: hiddenSize, width: outputSize, nodeType: 'train' }, 'random');
  graph.createNode('B2', { height: 1, width: outputSize, nodeType: 'train' }, 'random');
  graph.createNode('Y2', { height: batchSize, width: outputSize, nodeType: 'intermediate' });

  graph.multiplyAdd({ x: 'R1', w: 'W2', b: 'B2', y: 'Y2' });
  graph.createNode('Y', { height: batchSize, width: outputSize, nodeType: 'output' });
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

  graph.createNode('Expected', { height: batchSize, width: outputSize, nodeType: 'output' });
  graph.postMessage({
    type: 'setValues', payload: { name: 'Expected', values: [0, 1, 1, 0] }
  });

  graph.loss({ actual: 'Y', expected: 'Expected' });
}

async function solveXor(graph) {
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'W1', values: [  // 2x3
        -1, 1, 0,
        1, -1, 0]
    }
  });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'B1', values: [0, 0, 0]
    }
  });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'W2', values: [1, 1, 0]
    }
  });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'B2', values: [0]
    }
  });
}


async function buildConnectionTest(graph) {
  graph.createNode('R1', { height: 4, width: 3, nodeType: 'intermediate' });
  graph.createNode('W2', { height: 3, width: 1, nodeType: 'train' });
  graph.createNode('B2', { height: 1, width: 1, nodeType: 'train' });
  graph.createNode('Y2', { height: 4, width: 1, nodeType: 'intermediate' });
  graph.createNode('E', { height: 4, width: 1, nodeType: 'output' });
  graph.multiplyAdd({ x: 'R1', w: 'W2', b: 'B2', y: 'Y2' });
  graph.loss({ actual: 'Y2', expected: 'E' });

  graph.postMessage({
    type: 'setValues', payload: {
      name: 'R1', values: [
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
        0, 0, 1]
    }
  });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'W2', values: [0.10, 1.27, -1.01]
    }
  });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'B2', values: [0.39]
    }
  });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'E', values: [0.0, 1.0, 1.0, 0.0]
    }
  });
}

async function buildSolvedXorGraph(graph) {
  await buildXorGraph(graph);
  await solveXor(graph);
}

async function buildMMABGraph(graph) {

  function rep(n) {
    let a = [];
    for (let i = 0; i < n; i++) {
      a.push(1.0);
    }
    return a;
  }
  const batchSize = 4;
  const hiddenSize = 3;
  const outputSize = 1;  // 1 value per output

  graph.createNode('R1', { height: batchSize, width: hiddenSize, nodeType: 'intermediate' });
  graph.createNode('W2', { height: hiddenSize, width: outputSize, nodeType: 'intermediate' });
  graph.createNode('B2', { height: 1, width: outputSize, nodeType: 'intermediate' });
  graph.createNode('Y2', { height: batchSize, width: outputSize, nodeType: 'intermediate' });

  graph.multiplyAdd({ x: 'R1', w: 'W2', b: 'B2', y: 'Y2' });

  graph.postMessage({
    type: 'setValues', payload: {
      name: 'R1', values: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]
    }
  });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'W2', values: [1, 1, 0]
    }
  });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'B2', values: [0]
    }
  });
}

async function init() {
  console.log('Initializing...');
  const urlParams = new URLSearchParams(window.location.search);
  const graphType = urlParams.get('g');

  const graphBuilders = {
    'xor': buildXorGraph,
    'mmab': buildMMABGraph,
    'solution': buildSolvedXorGraph,
    'relu': buildReluGraph,
    'value': buildValueGraph,
    'identity': buildIdentityGraph,
    'connection': buildConnectionTest,
  };

  const builder = graphBuilders[graphType];
  if (!builder) {
    console.log('No specific graph type requested or unknown type. Available graphs:');
    const p = document.createElement('p');
    p.innerText = 'Please select a graph type from the list below:';
    document.body.appendChild(p);
    const list = document.createElement('ul');
    for (const type of Object.keys(graphBuilders)) {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = `?g=${type}`;
      link.textContent = type;
      listItem.appendChild(link);
      list.appendChild(listItem);
    }
    document.body.appendChild(list);
    return;
  }

  const graph = await GraphClient.create();

  // Add a slider for learning rate
  const learningRateDiv = document.createElement('div');
  learningRateDiv.innerHTML = `
    <label for="learningRateSlider">Learning Rate:</label>
    <input type="range" id="learningRateSlider" min="0.01" max="1.0" value="0.05" step="0.01">
    <span id="learningRateValue">0.05</span>
  `;
  document.body.appendChild(learningRateDiv);

  const learningRateSlider = /** @type {HTMLInputElement} */ (document.getElementById('learningRateSlider'));
  const learningRateValueSpan = /** @type {HTMLSpanElement} */ (document.getElementById('learningRateValue'));

  learningRateSlider.oninput = () => {
    learningRateValueSpan.textContent = learningRateSlider.value;
  };

  // Modify applyGradients and runX to use the slider value
  const getLearningRate = () => parseFloat(learningRateSlider.value);
  await builder(graph);
  {
    const b = document.createElement('button');
    b.innerText = 'Forward';
    b.onclick = graph.runForward.bind(graph);
    document.body.appendChild(b);
  }
  {
    const b = document.createElement('button');
    b.innerText = 'Calculate';
    b.onclick = graph.calculateGradients.bind(graph);
    document.body.appendChild(b);
  }
  {
    const b = document.createElement('button');
    b.innerText = 'Apply';
    b.onclick = () => {
      const lr = getLearningRate();
      console.log(`Learning rate: ${lr}`);
      graph.applyGradients(lr);
    }
    document.body.appendChild(b);
  }
  {
    const b = document.createElement('button');
    b.innerText = 'run 10x';
    b.onclick = () => {
      const lr = getLearningRate();
      console.log(`Learning rate: ${lr}`);
      graph.runX(10, getLearningRate());
    }
    document.body.appendChild(b);
  }
  {
    const b = document.createElement('button');
    b.innerText = 'run 1000x';
    b.onclick = () => {
      const lr = getLearningRate();
      console.log(`Learning rate: ${lr}`);
      graph.runX(1000, getLearningRate());
    }
    document.body.appendChild(b);
  }

  await graph.displayAllNodes();
}


document.addEventListener('DOMContentLoaded', () => { init(); });