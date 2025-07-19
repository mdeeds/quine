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
      name: 'X', values: [-3, -2, -1, 1, 2, 3]
    }
  });
  graph.createNode('E', { height: 3, width: 2, nodeType: 'output' });
  graph.postMessage({
    type: 'setValues', payload: {
      name: 'E', values: [-3, -2, -1, 1, 2, 3]
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
  const hiddenSize = 3;
  const outputSize = 1;  // 1 value per output

  graph.createNode('X', { height: batchSize, width: inputSize, nodeType: 'input' });
  graph.createNode('W1', { height: inputSize, width: hiddenSize, nodeType: 'train' });
  graph.createNode('B1', { height: 1, width: hiddenSize, nodeType: 'train' });
  graph.createNode('Y1', { height: batchSize, width: hiddenSize, nodeType: 'intermediate' });

  graph.multiplyAdd({ x: 'X', w: 'W1', b: 'B1', y: 'Y1' });

  graph.createNode('R1', { height: batchSize, width: hiddenSize, nodeType: 'intermediate' });
  graph.postMessage({ type: 'relu', payload: { x: 'Y1', y: 'R1' } });

  graph.createNode('W2', { height: hiddenSize, width: outputSize, nodeType: 'train' });
  graph.createNode('B2', { height: outputSize, width: 1, nodeType: 'train' });
  graph.createNode('Y2', { height: batchSize, width: outputSize, nodeType: 'intermediate' });

  graph.multiplyAdd({ x: 'Y1', w: 'W2', b: 'B2', y: 'Y2' });
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


async function init() {
  console.log('Initializing...');
  const graph = await GraphClient.create();
  const urlParams = new URLSearchParams(window.location.search);
  const graphType = urlParams.get('g');

  switch (graphType) {
    case 'xor':
      await buildXorGraph(graph);
      break;
    case 'value':
      await buildValueGraph(graph);
      break;
    case 'identity':
      await buildIdentityGraph(graph);
      break;
    default:
      // Handle other graph types or a default case
      console.log('No specific graph type requested or unknown type.');
    // Optionally, build a default graph or show an error
  }

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
    b.onclick = graph.applyGradients.bind(graph);
    document.body.appendChild(b);
  }
  {
    const b = document.createElement('button');
    b.innerText = 'run 10x';
    b.onclick = graph.runX.bind(graph, 10);
    document.body.appendChild(b);
  }
  {
    const b = document.createElement('button');
    b.innerText = 'run 1000x';
    b.onclick = graph.runX.bind(graph, 1000);
    document.body.appendChild(b);
  }
  await graph.displayAllNodes();
}


document.addEventListener('DOMContentLoaded', () => { init(); });