// @ts-check

import { Gpu } from './gpu.js';
import { LogicalMatrix } from './matrix.js';

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

/**
 * Represents a simple fully connected layer without a bias vector:
 * Y = W X
 * `dw` and `dy` are matricies the same size as W and Y (respectively)
 * When `backward` is called, the gradients in `dy` are propagated to `dw`
 * based on the current activations in `x`
 */
export class MatrixMultiplyOperation extends Operation {
  constructor(gpu, w, dw, x, dx, y, dy) {
    super();
    this.gpu = gpu;
    this.w = w;
    this.dw = dw;
    this.x = x;
    this.dx = dx;
    this.y = y;
    this.dy = dy;
  }

  forward() {
    this.gpu.executeMatrixMultiply(this.w, this.x, this.y);
  }


  /**
   * The backward pass for Y = WX involves two main gradient calculations:
   *  1. Gradient with respect to W (weights): dL/dW = (dL/dY) * X^T
   *   This means we multiply the gradient of the output (dy) by the transpose of the input (x).
   *   The result is accumulated into dw.
   *  2. Gradient with respect to X (input): dL/dX = W^T * (dL/dY)
   *   This means we multiply the transpose of the weights (w) by the gradient of the output (dy).
   *   The result is accumulated into dx.
   */
  backward() {
    this.gpu.executeMatrixMultiplyT2(this.dy, this.x, this.dw);
    this.gpu.executeMatrixMultiplyT1(this.w, this.dy, this.dx);
  }

}

export class FullyConnectedOperation extends Operation {
  /**
   * Creates a fully connected layer: 
   * Y = XW + B
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
    this.gpu.executeMatrixMultiplyAddBias(this.x, this.w, this.b, this.y);
  }

  backward() {
    // dW = X^T dY
    // dB = sum(dY across all batches; i.e. sum colunmns)
    // dX = dY W^T
    this.gpu.executeMatrixMultiplyT1(this.x, this.dy, this.dw);
    this.gpu.executeColSum(this.dy, this.db);
    this.gpu.executeMatrixMultiplyT2(this.dy, this.w, this.dx);
  }
}

export class ReluOperation extends Operation {
  /**
   * Y = RELU(X)
   * @param {Gpu!} gpu 
   * @param {LogicalMatrix!} x 
   * @param {LogicalMatrix!} y 
   * @param {LogicalMatrix!} dx 
   * @param {LogicalMatrix!} dy 
   */
  constructor(gpu, x, y, dx, dy) {
    super();
    this.gpu = gpu;
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
  }

  forward() {
    // Y = RELU(X)
    this.gpu.executeRelu(this.x, this.y);
  }

  backward() {
    // dX = dy (.) STEP(Y)
    this.gpu.executeMulStep(this.y, this.dy, this.dx);
  }
}

/** 
 * Implement an AddBias operation.  This should add a vector to the values in
 * a matrix.  The vector's length will be equal to the matrix's width.
 */

/**
 * TODO: Sloppy Relu
 * In the forward pass, this is simply `y = max(0, x)`
 * In the backward pass, this is dy/dx = atan(x) + pi/2
 * This is super cheap to compute in both directions, and the small positive gradient
 * when the input is negative helps prevent "dead neurons".
 * The mismatched f'(x) is called "gradient shaping"
 */

/**
 * TODO: Smooth L1 loss
 * This is a type of Huber-like Loss.  It's also a form of gradient shaping.
 * In the forward pass, the loss is `Loss = abs(error)`
 * In the backward pass, dLoss/dError = -1 if error < pi, 1 if error > pi, sin(error) otherwise.
 */