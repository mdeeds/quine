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

  const W1 = graph.createNode('W1', { width: inputSize, height: hiddenSize });
  const X = graph.createNode('X', { width: batchSize, height: inputSize });
  const B1 = graph.createNode('B1', { width: 1, height: hiddenSize });
  const Y1 = graph.createNode('Y', { width: batchSize, height: hiddenSize });

  graph.multiplyAdd(W1, X, B1, Y1);

  const W2 = graph.createNode('W2', { width: hiddenSize, height: outputSize });
  //    Y1 = graph.CreateNode({width: batchSize, height: hiddenSize});
  const B2 = graph.createNode('B2', { width: 1, height: outputSize });

  const Y = graph.createNode('Y', { width: batchSize, height: outputSize });

  graph.multiplyAdd(W2, Y1, B2, Y);

  const components = graph.getComponentsInBuildOrder();
  for (const component of components) {
    console.log(component.getDescription());
  }

  // const Expected = graph.createNode({ width: batchSize, height: outputSize });

  // graph.addLoss({ actual: Y, expected: Expected });

}

document.addEventListener('DOMContentLoaded', () => { init(); });