// This class holds a few of the objects neccessary for performing calculations etc.
export class Context {
  /**
  * 
  * @param {WebGL2RenderingContext} gl
  * @param {WebGLFramebuffer} fbo
    */
  constructor(gl, fbo) {
    this.gl = gl;
    this.fbo = fbo;
  }
}