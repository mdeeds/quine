// @ts-check

import { Gpu } from './gpu.js';
import { LogicalMatrix } from './matrix.js';
import { FullyConnectedOperation, ReluOperation } from './operation.js';

/**
 * @typedef {object} MatrixSpec
 * @property {number} width
 * @property {number} height
 * @property {string!} nodeType
 */

/**
 * @typedef {Connection | Node} ConnectionOrNode
 */

/**
 * @typedef {object} Dependency
 * @property {ConnectionOrNode} source
 * @property {ConnectionOrNode} target
 */

export class Graph {
  /**
   * 
   * @param {Gpu!} gpu 
   */
  constructor(gpu) {
    this.gpu = gpu;
    this.components = []; /** @type {Array<ConnectionOrNode>} */
    this.allNodes = new Set();  /** @type {Set<Node>} */
    this.allConnections = new Set();  /** @type {Set<Connection>} */

    this.nodeMap = new Map();  /** @type {Map<string, Node>} */

    this.dependencies = [];  /** @type {Array<Dependency>} */

    this.lossPairs = [];  /** @type {Array<{actual: Node, expected: Node}>} */
  }

  /**
   * 
   * @param {string!} name 
   * @param {MatrixSpec!} spec 
   */
  createNode(name, spec) {
    if (this.nodeMap.has(name)) {
      throw new Error(`Node with name ${name} already exists.`);
    }
    this.nodeMap.set(name, spec)
    const node = new Node(this.gpu, name, spec);
    this.components.push(node);
    this.allNodes.add(node);
    this.nodeMap.set(name, node);
  }

  /**
   * 
   * @param {Object} spec
   * @param {string!} spec.x 
   * @param {string!} spec.w 
   * @param {string!} spec.b 
   * @param {string!} spec.y 
   */
  multiplyAdd({ x, w, b, y }) {
    const xNode = this.nodeMap.get(x);
    const wNode = this.nodeMap.get(w);
    const bNode = this.nodeMap.get(b);
    const yNode = this.nodeMap.get(y);
    if (!xNode || !wNode || !bNode || !yNode) {
      throw new Error("Invalid node name.");
    }

    const connection = new MultiplyAdd(this.gpu, xNode, wNode, bNode, yNode);
    this.components.push(connection);
    this.allConnections.add(connection);
    this.dependencies.push({ source: xNode, target: connection });
    this.dependencies.push({ source: wNode, target: connection });
    this.dependencies.push({ source: bNode, target: connection });
    this.dependencies.push({ source: connection, target: yNode });
  }

  relu({ x, y }) {
    const xNode = this.nodeMap.get(x);
    const yNode = this.nodeMap.get(y);
    if (!xNode || !yNode) {
      throw new Error("Invalid node name.");
    }
    const connection = new Relu(
      this.gpu, xNode, yNode);
    this.components.push(connection);
    this.allConnections.add(connection);
    this.dependencies.push({ source: xNode, target: connection });
    this.dependencies.push({ source: connection, target: yNode });
  }

  /**
   * 
   * @param {{actual: Node, expected: Node}} spec
   */
  loss({ actual, expected }) {
    const actualNode = this.nodeMap.get(actual);
    const expectedNode = this.nodeMap.get(expected);
    if (!actualNode || !expectedNode) {
      throw new Error("Invalid node name.");
    }
    this.lossPairs.push({ actual: actualNode, expected: expectedNode });
  }

  /**
   * Returns all Nodes and Connections in build order.  I.e. all sources
   * are returned before their targets.
   * @returns {Array<ConnectionOrNode>}
   */
  getComponentsInBuildOrder() {
    const result = [];
    const visited = new Set();
    const visiting = new Set();

    /**
     * @param {ConnectionOrNode} component
     */
    function dfs(component) {
      if (visited.has(component)) {
        return;
      }
      if (visiting.has(component)) {
        throw new Error('Cyclic dependency detected in graph.');
      }

      visiting.add(component);

      // Find all components that this component depends on (its sources)
      const dependencies = graph.dependencies.filter(dep => dep.target === component);
      for (const dep of dependencies) {
        dfs(dep.source);
      }

      visiting.delete(component);
      visited.add(component);
      result.push(component);
    }

    // Create a temporary graph object to pass to dfs
    const graph = this;

    // Start DFS from all components that are targets (i.e., have incoming dependencies)
    // Or, more robustly, start from all components and let the visited set handle pruning.
    for (const component of this.components) {
      dfs(component);
    }
    return result;
  }

  /**
   * Executes the `forward` function on all connections in forward order
   */
  forward() {
    const components = this.getComponentsInBuildOrder();
    for (const component of components) {
      // Only components that are instances of Connection have a forward method.
      // Nodes do not have a forward method.
      if (component['forward']) {
        component['forward'](); // Call the forward method if it exists
      }
    }
  }

  /**
   * This will clear all gradients from nodes unless they have isOutput set.
   * Before calling this function, you should set the gradients on all of the output nodes.
   * Gradients are applied to all nodes except for inputs and outputs.
   * @param {number!} learningRate 
   */
  backwardAndAddGradient(learningRate) {
    // Compute the loss and put the gradient into the output node.
    for (const { actual, expected } of this.lossPairs) {
      this.gpu.executeLoss(
        {
          actual: actual.value,
          expected: expected.value,
          dLoss: actual.gradient
        });
    }

    const components = this.getComponentsInBuildOrder().reverse();

    // Clear gradients on all non-output nodes.
    for (const component of components) {
      if (this.allNodes.has(component)) {
        // Nodes have a `gradient`.  Set these to zero.
        const node = component;  /** @type {Node} */
        if (node.spec.nodeType != 'output') {
          const matrix = node.gradient;  /** @type {LogicalMatrix} */
          const fbo = this.gpu.context.fbo;
          const gl = this.gpu.gl;
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, matrix.texture, 0);
          gl.clearColor(0.0, 0.0, 0.0, 0.0);
          gl.viewport(0, 0, matrix.width, matrix.height);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
      }
    }
    // Compute and apply the gradients
    for (const component of components) {
      if (this.allConnections.has(component)) {
        const connection = component;  /** @type {Connection} */
        connection.backward(); // Call the backward method if it exists
      } else if (component['addGradient']) {
        const node = component;  /** @type {Node} */
        if (node.spec.nodeType === 'train') {
          node.addGradient(learningRate);
        }
      }
    }
  }
}

export class Node {
  /**
   * 
   * @param {Gpu!} gpu
   * @param {string!} name
   * @param {MatrixSpec!} spec 
   */
  constructor(gpu, name, spec) {
    this.gpu = gpu;
    this.name = name;
    this.spec = spec;
    // At some point, we might want to think about pooling these textures.

    /** @type {LogicalMatrix!} */
    this.value = new LogicalMatrix(gpu.context, spec.width, spec.height, 'zero');

    /** @type {LogicalMatrix!} */
    this.gradient = new LogicalMatrix(gpu.context, spec.width, spec.height, 'zero');
  }

  /**
   * 
   * @param {number!} learningRate
   */
  addGradient(learningRate) {
    this.gpu.executeMatrixUpdate(this.gradient, -learningRate, this.value);
  }

  /**
   * @returns {ComponentDescription!}
   */
  getDescription() {
    const detail = `${this.name} : matrix ${this.spec.height}x${this.spec.width}`;
    return {
      name: this.name,
      type: 'node',
      detail
    };
  }
}

export class Connection {
  constructor(operation) {
    this.operation = operation;
  };

  /**
   * 
   * @returns {ComponentDescription!}
   */
  getDescription() {
    return {
      name: 'NA',
      type: 'operation',
      detail: this.getDetail()
    };
  }

  /**
   * 
   * @returns {string!}
   */
  getDetail() {
    throw new Error("Implemented in child class.");
  }

  forward() {
    this.operation.forward();
  }

  backward() {
    this.operation.backward();
  }

  addGradient(learningRate) {
    this.operation.addGradient(learningRate);
  }
}

export class MultiplyAdd extends Connection {
  /**
   * Arranges y = wx + b in the graph.
   * @param {Gpu!} gpu
   * @param {Node!} x 
   * @param {Node!} w 
   * @param {Node!} b 
   * @param {Node!} y 
   */
  constructor(gpu, x, w, b, y) {
    super(new FullyConnectedOperation(gpu,
      x.value, w.value, b.value, y.value,
      x.gradient, w.gradient, b.gradient, y.gradient));
    this.w = w;
    this.x = x;
    this.b = b;
    this.y = y;
  }

  getDetail() {
    return `${this.y.name} = ${this.w.name} * ${this.x.name} + ${this.b.name}`;
  }
}

export class Relu extends Connection {
  constructor(gpu, x, y) {
    super(new ReluOperation(gpu, x.value, y.value, x.gradient, y.gradient));
    this.x = x;
    this.y = y;
  }

  getDetail() {
    return `${this.y.name} = relu(${this.x.name})`;
  }
}
