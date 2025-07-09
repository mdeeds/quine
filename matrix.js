// @ts-check

import { Context } from './context.js';

export class LogicalMatrix {
  /**
   * 
   * @param {Context!} context 
   * @param {number} width 
   * @param {number} height 
   * @param {Float32Array?} data
   */
  constructor(context, width, height,
    initialization = 'random', data = null) {
    this.width = width;
    this.height = height;
    this.context = context;
    let texture = undefined;
    switch (initialization) {
      case 'random':
        texture = this._createFloatTexture(this._createRandomData());
        break;
      case 'identity':
        texture = this._createFloatTexture(this._createIdentityData());
        break;
      case 'zero':
        const zeroData = new Float32Array(this.width * this.height);
        texture = this._createFloatTexture(zeroData);
        break;
      case 'data':
        if (!data) {
          throw "Data must be specified when creating from data.";
        }
        texture = this._createFloatTexture(data);
        break;
      default:
        throw 'Invalid initialization type'
    }
    if (!texture) {
      throw new Error('Failed to create texture.');
    }
    this.texture = texture;
  }

  /**
   * Updates the texture with new data from a Float32Array.
   * @param {Float32Array!} data 
   */
  setValues(data) {
    if (data.length !== this.width * this.height) {
      throw new Error(`Data size (${data.length}) does not match matrix dimensions (${this.width}x${this.height}).`);
    }
    const gl = this.context.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RED, gl.FLOAT, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }


  /**
   * 
   * @param {Float32Array?} data 
   * @returns 
   */
  _createFloatTexture(data = null) {
    const gl = this.context.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.width, this.height, 0,
      gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  /**
   * @returns {number} a roughly gaussian number centered at zero with a 
   * standard deviation about 0.1.
   */
  _rn() {
    return 0.1 * (Math.random() - Math.random() + Math.random() - Math.random());
  }

  /**
   * @returns {Float32Array!} Random data
   */
  _createRandomData() {
    const data = new Float32Array(this.width * this.height);
    for (let i = 0; i < data.length; i++) {
      data[i] = this._rn();
    }
    return data;
  }
  /**
   * @returns {Float32Array!} Identity data
   */
  _createIdentityData() {
    const data = new Float32Array(this.width * this.height);
    for (let j = 0; j < this.height; j++) {
      for (let i = 0; i < this.width; i++) {
        data[j * this.width + i] = (i === j) ? 1.0 : 0.0;
      }
    }
    return data;
  }
}