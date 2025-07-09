// @ts-check

import { Gpu } from './gpu.js';
import { Graph } from './graph.js';

async function init() {
  const gpu = await Gpu.create();
  const graph = new Graph(gpu);

  // Construct a simple two-layer net.

  // Y1 = W1 X + B1
  // Y = W2 Y1 + B2

  const batchSize = 4;
  const inputSize = 2;  // 2 values per sample
  const hiddenSize = 3;
  const outputSize = 1;  // 1 value per output

  const W1 = graph.createNode('W1', { width: inputSize, height: hiddenSize, nodeType: 'train' });
  const X = graph.createNode('X', { width: batchSize, height: inputSize, nodeType: 'input' });
  const B1 = graph.createNode('B1', { width: 1, height: hiddenSize, nodeType: 'train' });
  const Y1 = graph.createNode('Y1', { width: batchSize, height: hiddenSize, nodeType: 'intermediate' });

  graph.multiplyAdd(W1, X, B1, Y1);

  const W2 = graph.createNode('W2', { width: hiddenSize, height: outputSize, nodeType: 'train' });
  //    Y1 = graph.CreateNode({width: batchSize, height: hiddenSize});
  const B2 = graph.createNode('B2', { width: 1, height: outputSize, nodeType: 'train' });

  const Y = graph.createNode('Y', { width: batchSize, height: outputSize, nodeType: 'output' });

  graph.multiplyAdd(W2, Y1, B2, Y);

  X.value.setValues(new Float32Array([  // 2x4
    0, 1, 0, 1, // row 1
    0, 0, 1, 1]));  // row 2


  const components = graph.getComponentsInBuildOrder();
  for (const component of components) {
    console.log(component.getDescription());
  }

  const Expected = graph.createNode('Expeted',
    { width: batchSize, height: outputSize, nodeType: 'output' });
  Expected.value.setValues(new Float32Array([0, 1, 1, 0]));

  // graph.addLoss({ actual: Y, expected: Expected });

}

document.addEventListener('DOMContentLoaded', () => { init(); });