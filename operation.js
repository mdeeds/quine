// @ts-check

/**
 * An "Operation" supports both forward and backward passes.  Internally, it has inputs and outputs.
 * These are all instances of LogicalMatrix.  Additionally, it has matricies that are the gradients
 * dL/dX and dL/dY for all of the inputs (X's) and outputs (Y's)
 * 
 * The 'forward' function uses the operation's inputs to update the outputs.
 *  I.e. [outputs] = Op([inputs])
 * 
 * The 'backward' function uses the current state of the operation (I.e. inputs and outputs) as well
 * as the current values in the dL/dY matrix to update all gradients including the dL/dX gradient of
 * its inputs.
 */
class Operation {
  constructor() {
  }

  /**
   * Performs the forward pass of the operation.
   * This method should be implemented by subclasses.
   * Updates values in `this.outputs` based on values in `this.inputs`.
   */
  forward() {
    throw new Error("Forward method must be implemented by subclasses.");
  }

  /**
   * Performs the backward pass of the operation.
   * This method should be implemented by subclasses.
   * It uses the output gradients to compute and update the input gradients.
   */
  backward() {
    throw new Error("Backward method must be implemented by subclasses.");
  }
}

class FullyConnectedOperation extends Operation {
  /**
   * Creates a fully connected layer: 
   * y = xw + b
   * @param {Gpu!} gpu 
   * @param {LogicalMatrix!} x
   * @param {LogicalMatrix!} w 
   * @param {LogicalMatrix!} b 
   * @param {LogicalMatrix!} y 
   * @param {LogicalMatrix!} dx 
   * @param {LogicalMatrix!} dw 
   * @param {LogicalMatrix!} db 
   * @param {LogicalMatrix!} dy
   */
  constructor(gpu, x, w, b, y, dx, dw, db, dy) {
    super();
    this.gpu = gpu;
    this.x = x;
    this.w = w;
    this.b = b;
    this.y = y;
    this.dx = dx;
    this.dw = dw;
    this.db = db;
    this.dy = dy;
  }

  forward() {
    this.gpu.executeMatrixMultiplyAndAddBias(this.x, this.w, this.b, this.y);
  }

  backward() {

  }
}