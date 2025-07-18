// @ts-check

import { GraphClient } from './worker/client.js';

let uid = 1;

class GraphTest {
  constructor() {
    this.init();
  }

  async init() {
    console.log('Initializing...');
    const graph = await GraphClient.create();

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

    {
      const b = document.createElement('button');
      b.innerText = 'Forward';
      b.onclick = graph.runForward.bind(graph);
      document.body.appendChild(b);
    }
    {
      const b = document.createElement('button');
      b.innerText = 'Backward';
      b.onclick = graph.runBackward.bind(graph);
      document.body.appendChild(b);
    }
    {
      const b = document.createElement('button');
      b.innerText = 'run 10x';
      b.onclick = graph.runX.bind(graph, 10);
      document.body.appendChild(b);
    }
    await graph.displayAllNodes();
  }
}

async function init() {
  new GraphTest();
}


document.addEventListener('DOMContentLoaded', () => { init(); });