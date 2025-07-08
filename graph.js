// @ts-check

import { Gpu } from './gpu.js';

/**
 * @typedef {object} MatrixSpec
 * @property {number} width
 * @property {number} height
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

    this.dependencies = [];  /** @type {Array<Dependency>} */
  }

  /**
   * 
   * @param {string!} name 
   * @param {MatrixSpec!} spec 
   * @returns {Node!}
   */
  createNode(name, spec) {
    const node = new Node(name, spec);
    this.components.push(node);
    return node;
  }

  multiplyAdd(w, x, b, y) {
    const connection = new MultiplyAdd(w, x, b, y);
    this.components.push(connection);
    this.dependencies.push({ source: w, target: connection });
    this.dependencies.push({ source: x, target: connection });
    this.dependencies.push({ source: b, target: connection });
    this.dependencies.push({ source: connection, target: y });
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
}

export class Node {
  /**
   * 
   * @param {string!} name
   * @param {MatrixSpec!} spec 
   */
  constructor(name, spec) {
    this.name = name;
    this.spec = spec;
    this.value = null;
    this.gradient = null;
  }

  /**
   * @returns {string!}
   */
  getDescription() {
    return `${this.name} : matrix ${this.spec.height}x${this.spec.width}`;
  }
}

export class Connection {
  constructor() { };
  getDescription() {
    throw new Error("Implemented in child class.");
  }
}

export class MultiplyAdd extends Connection {
  /**
   * Arranges y = wx + b in the graph.
   * @param {Node!} w 
   * @param {Node!} x 
   * @param {Node!} b 
   * @param {Node!} y 
   */
  constructor(w, x, b, y) {
    super();
    this.w = w;
    this.x = x;
    this.b = b;
    this.y = y;
  }

  getDescription() {
    return `${this.y.name} = ${this.w.name} * ${this.x.name} + ${this.b.name}`;
  }
}
