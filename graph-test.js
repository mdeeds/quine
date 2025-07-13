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

  const X = graph.createNode('X', { height: batchSize, width: inputSize, nodeType: 'input' });
  const W1 = graph.createNode('W1', { height: inputSize, width: hiddenSize, nodeType: 'train' });
  const B1 = graph.createNode('B1', { height: 1, width: hiddenSize, nodeType: 'train' });
  const Y1 = graph.createNode('Y1', { height: batchSize, width: hiddenSize, nodeType: 'intermediate' });

  graph.multiplyAdd(X, W1, B1, Y1);

  //    Y1 = graph.CreateNode({height: batchSize, width: hiddenSize});
  const W2 = graph.createNode('W2', { height: hiddenSize, width: outputSize, nodeType: 'train' });
  const B2 = graph.createNode('B2', { height: outputSize, width: 1, nodeType: 'train' });

  const Y = graph.createNode('Y', { height: batchSize, width: outputSize, nodeType: 'output' });

  graph.multiplyAdd(Y1, W2, B2, Y);

  X.value.setValues(new Float32Array([  // 2x4
    0, 1, 0, 1, // row 1
    0, 0, 1, 1]));  // row 2


  const components = graph.getComponentsInBuildOrder();
  for (const component of components) {
    console.log(component.getDescription());
  }

  const expected = graph.createNode('Expeted',
    { width: batchSize, height: outputSize, nodeType: 'output' });
  expected.value.setValues(new Float32Array([0, 1, 1, 0]));

  graph.loss({ actual: Y, expected: expected });

  graph.forward();
  graph.backwardAndAddGradient(0.05);
}

document.addEventListener('DOMContentLoaded', () => { init(); });