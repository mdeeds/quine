// @ts-check

import { Context } from './context.js';
import { LogicalMatrix } from './matrix.js';

export class Gpu {
  /**
   * Do not use this constructor. Please use the async create method instead.
   * @param {WebGL2RenderingContext} gl 
   * @param {WebGLFramebuffer} fbo
   */
  constructor(gl, fbo) {
    this.gl = gl;
    /** @type {Context} */ this.context = new Context(gl, fbo);
    /** @type {_MatrixMultiplyProgram | null} */ this.mm_program = null;
    /** @type {_MatrixUpdateProgram | null} */ this.mu_program = null;
    /** @type {_MatrixUpdateProgram | null} */ this.matanu_program = null;
    /** @type {_MatrixMultiplyT1Program | null} */ this.mmt1_program = null;
    /** @type {_MatrixMultiplyT2Program | null} */ this.mmt2_program = null;
    /** @type {_MatrixMultiplyAddBiasProgram | null} */ this.mmab_program = null;
    /** @type {WebGLBuffer | null} */ this.quadPositionBuffer = null;
    /** @type {WebGLBuffer | null} */ this.quadTexCoordBuffer = null;
  }

  /**
   * @returns {Promise<Gpu>}
   */
  static async create() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) {
      throw new Error('Unable to initialize WebGL 2.0. Your browser or hardware ' +
        'may not support it.');
    }

    // Check for the required extension for rendering to float textures
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
      throw new Error('This browser does not support the EXT_color_buffer_float ' +
        'extension, which is required for rendering to float textures.');
    }
    const fbo = gl.createFramebuffer();
    if (!fbo) {
      throw new Error('Failed to create framebuffer.');
    }
    const gpu = new Gpu(gl, fbo);
    await gpu._initialize();
    return gpu;
  }

  /**
   * @param {WebGLTexture} texture 
   * @returns {void}
   */
  deleteTexture(texture) {
    this.gl.deleteTexture(texture);
  }

  /**
   * @param {LogicalMatrix!} a 
   * @param {LogicalMatrix!} b
   * @param {LogicalMatrix!} c 
   */
  executeMatrixMultiply(a, b, c) {
    if (!this.mm_program) {
      throw new Error('Matrix multiply program not initialized.');
    }
    this.mm_program.execute(a, b, c);
  }

  /**
   * @param {LogicalMatrix!} a 
   * @param {number} alpha
   * @param {LogicalMatrix!} y 
   */
  executeMatrixUpdate(a, alpha, y) {
    if (!this.mu_program) {
      throw new Error('Matrix multiply program not initialized.');
    }
    this.mu_program.execute(a, alpha, y);
  }

  /**
   * 
   * @param {LogicalMatrix} a 
   * @param {number} alpha 
   * @param {LogicalMatrix} y 
   */
  executeMatrixAtanUpdate(a, alpha, y) {
    if (!this.matanu_program) {
      throw new Error('Matrix multiply program not initialized.');
    }
    this.matanu_program.execute(a, alpha, y);
  }

  /**
   * @param {LogicalMatrix!} a 
   * @param {LogicalMatrix!} b
   * @param {LogicalMatrix!} c 
   */
  executeMatrixMultiplyT1(a, b, c) {
    if (!this.mmt1_program) {
      throw new Error('Matrix multiply program not initialized.');
    }
    this.mmt1_program.execute(a, b, c);
  }

  /**
   * @param {LogicalMatrix!} a 
   * @param {LogicalMatrix!} b
   * @param {LogicalMatrix!} c 
   */
  executeMatrixMultiplyT2(a, b, c) {
    if (!this.mmt2_program) {
      throw new Error('Matrix multiply program not initialized.');
    }
    this.mmt2_program.execute(a, b, c);
  }

  /**
   * Executes y = wx + b
   * @param {LogicalMatrix!} x
   * @param {LogicalMatrix!} w
   * @param {LogicalMatrix!} b 
   * @param {LogicalMatrix!} y 
   */
  executeMatrixMultiplyAddBias(x, w, b, y) {
    if (!this.mmab_program) {
      throw new Error('Matrix multiply and add bias program not initialized.');
    }
    this.mmab_program.execute(x, w, b, y);
  }

  executeLoss(expected, actual, dLoss) {
    if (!this.mdl_program) {
      throw new Error('Loss program is not initialized');
    }
    this.mdl_program.execute(expected, actual, dLoss);
  }

  /**
   * 
   * @param {LogicalMatrix!} x 
   * @param {LogicalMatrix!} y 
   */
  executeRelu(x, y) {
    if (!this.relu_program) {
      throw new Error('Relu program is not initialized');
    }
    this.relu_program.execute(x, y);
  }

  /**
   * 
   * @param {LogicalMatrix!} x 
   * @param {LogicalMatrix!} y 
   */
  executeStep(x, y) {
    if (!this.step_program) {
      throw new Error('Step program is not initialized');
    }
    this.step_program.execute(x, y);
  }

  /*********************************
   *      PRIVATE METHODS
   *********************************/

  /**
   * 
   * @param {string} glslPath 
   * @returns {Promise<WebGLProgram!>}
   */
  async _fetchProgram(glslPath) {
    const code = await (await fetch(glslPath)).text();
    if (!code) {
      throw new Error(`Could not load fragment shader: ${glslPath}`);
    }
    try {
      const result = this._createProgram(code);
      return result;
    } catch {
      throw new Error(`Failed to create shader: ${glslPath}`);

    }
    throw new Error(`Failed to create shader: ${glslPath}`);
  }
  /**
   * @returns {Promise<void>}
   */
  async _initialize() {
    this._createQuadBuffers();
    this.mm_program = new _MatrixMultiplyProgram(
      this.context, await this._fetchProgram('fragments/mm.glsl'));
    this.mu_program = new _MatrixUpdateProgram(
      this.context, await this._fetchProgram('fragments/mscale.glsl'));
    this.mmt1_program = new _MatrixMultiplyT1Program(
      this.context, await this._fetchProgram('fragments/mmt1.glsl'));
    this.mmt2_program = new _MatrixMultiplyT2Program(
      this.context, await this._fetchProgram('fragments/mmt2.glsl'));
    this.mmab_program = new _MatrixMultiplyAddBiasProgram(
      this.context, await this._fetchProgram('fragments/mmab.glsl'));
    this.mdl_program = new _MatrixLossProgram(
      this.context, await this._fetchProgram('fragments/mdl.glsl'));
    this.relu_program = new _ElementwiseProgram(
      this.context, await this._fetchProgram('fragments/relu.glsl'));
    this.step_program = new _ElementwiseProgram(
      this.context, await this._fetchProgram('fragments/step.glsl'));
    return;
  }

  /**
   * @param {string} message 
   */
  _logInfo(message) {
    const div = document.getElementById('info');
    if (div) {
      div.innerHTML = message;
      console.log(div.innerText);
    }
  }

  /**
   * Creates a program for the provided fragment shader. This uses our standard
   * vertex shader and unit quads.
   * @param {string} fsSource 
   * @returns {WebGLProgram!}
   */
  _createProgram(fsSource) {
    // Vertex Shader (simple pass-through)
    const vsSource = `#version 300 es
        in vec3 aPos;
        in vec2 aTexCoord;
        out vec2 texCoord;
        void main() {
            gl_Position = vec4(aPos, 1.0);
            texCoord = aTexCoord;
        }
    `;
    const vertexShader = this._createShader(this.gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) {
      throw new Error('Shader creation failed.');
    }

    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program linking error:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      throw new Error('Program linking failed.');
    }
    this._setupQuad(program);
    return program;
  }

  /**
   * @param {GLenum} type 
   * @param {string} source 
   * @returns {WebGLShader!}
   */
  _createShader(type, source) {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader.');
    }
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      throw new Error('Shader compilation failed.');
    }
    return shader;
  }

  /**
   * Creates the buffers for the unit quad. These are created once and reused.
   */
  _createQuadBuffers() {
    const positions = new Float32Array([
      -1.0, 1.0, 0.0, // Top-left
      -1.0, -1.0, 0.0, // Bottom-left
      1.0, 1.0, 0.0, // Top-right
      1.0, -1.0, 0.0, // Bottom-right
    ]);

    const texCoords = new Float32Array([
      0.0, 1.0, // Top-left
      0.0, 0.0, // Bottom-left
      1.0, 1.0, // Top-right
      1.0, 0.0, // Bottom-right
    ]);
    this.quadPositionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadPositionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    this.quadTexCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadTexCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
  }

  /**
   * Adds our standard unit quads to the shader program.
   * @param {WebGLProgram} shaderProgram 
   */
  _setupQuad(shaderProgram) {
    // Set up vertex attribute pointers
    const posAttribLoc = this.gl.getAttribLocation(shaderProgram, 'aPos');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadPositionBuffer);
    this.gl.vertexAttribPointer(posAttribLoc, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(posAttribLoc);

    const texAttribLoc = this.gl.getAttribLocation(shaderProgram, 'aTexCoord');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadTexCoordBuffer);
    this.gl.vertexAttribPointer(texAttribLoc, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(texAttribLoc);
  }


  /**
   * Reads the pixel data from a texture back to the CPU.
   * @param {LogicalMatrix} matrix
   * @returns {Float32Array}
   */
  readPixels(matrix) {
    const { texture, width, height } = matrix;
    const gl = this.gl;
    const fbo = this.context.fbo;

    // Bind the framebuffer and attach the texture to read from.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // Check if the FBO is complete before reading.
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer not complete for reading pixels.');
    }

    const finalResult = new Float32Array(width * height);
    this.gl.readPixels(0, 0, width, height, this.gl.RED, this.gl.FLOAT, finalResult);

    // Unbind the FBO.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return finalResult;
  }
}

class _ElementwiseProgram {
  /**
   * 
   * @param {Context!} context 
   * @param {WebGLProgram!} program 
   */
  constructor(context, program) {
    /** @type {WebGLProgram} */
    this.program = program;
    this.context = context;
    const gl = context.gl;
    this.matrix_Loc = gl.getUniformLocation(program, 'matrix');
    if (!this.matrix_Loc) {
      throw new Error("Missing uniform location in elementwise program.");
    }
  }

  /**
   * 
   * @param {LogicalMatrix!} x 
   * @param {LogicalMatrix!} y 
   */
  execute(x, y) {
    const gl = this.context.gl
    if (!x.sameSize(y)) {
      throw new Error(`Matrix dimensions mismatch: X (${x.width}x${x.height}) and Y `);
    }
    gl.useProgram(this.program);
    gl.disable(gl.BLEND);
    const fbo = this.context.fbo;
    // Bind the single, reusable FBO and attach the destination texture.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, y.texture, 0);
    gl.viewport(0, 0, y.width, y.height); // Ensure viewport matches texture size

    // It's good practice to check FBO status after attaching a new texture.
    const fboStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (fboStatus !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer not complete after attaching texture: ' + fboStatus);
    }

    gl.activeTexture(gl.TEXTURE0); // x
    gl.bindTexture(gl.TEXTURE_2D, x.texture);
    gl.uniform1i(this.matrix_Loc, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Draw the quad
  }
}

class _MatrixMultiplyAddBiasProgram {
  /**
   * 
   * @param {Context!} context 
   * @param {WebGLProgram!} program 
   */
  constructor(context, program) {
    /** @type {WebGLProgram} */
    this.program = program;
    this.context = context;
    const gl = context.gl;
    this.matrixX_Loc = gl.getUniformLocation(program, 'matrixX');
    this.matrixW_Loc = gl.getUniformLocation(program, 'matrixW');
    this.matrixB_Loc = gl.getUniformLocation(program, 'matrixB');
    this.xWidth_Loc = gl.getUniformLocation(program, 'X_width');
    this.xHeight_Loc = gl.getUniformLocation(program, 'X_height');
    this.wWidth_Loc = gl.getUniformLocation(program, 'W_width');
    if (!this.matrixX_Loc || !this.matrixW_Loc || !this.matrixB_Loc ||
      !this.xWidth_Loc || !this.xHeight_Loc || !this.wWidth_Loc) {
      throw new Error("Missing uniform location in matrix multiply add bias program.");
    }
  }

  /**
   * 
   * @param {LogicalMatrix!} w 
   * @param {LogicalMatrix!} x 
   * @param {LogicalMatrix!} b 
   * @param {LogicalMatrix!} y 
   */
  execute(w, x, b, y) {
    // y = wx + b
    if (w.width !== x.height) {
      throw new Error(`Matrix dimension mismatch: W's width (${w.width}) must equal X's height (${x.height}).`);
    }
    if (w.height != y.height) {
      throw new Error(`Matrix dimension mismatch: W's height (${w.height}) must equal Y's height (${y.height}).`);
    }
    if (x.width != y.width) {
      throw new Error(`Matrix dimension mismatch: X's width (${x.width}) must equal Y's width (${y.width}).`);
    }
    if (b.height != 1) {
      throw new Error(`Matrix dimension mismatch: B's height (${b.height}) must equal 1.`);
    }
    if (b.width != y.width) {
      throw new Error(`Matrix dimension mismatch: B's width (${b.width}) must equal Y's width (${y.width}).`);
    }
    const gl = this.context.gl;
    const fbo = this.context.fbo;
    gl.useProgram(this.program);
    gl.disable(gl.BLEND);

    gl.uniform1i(this.xWidth_Loc, x.width);
    gl.uniform1i(this.xHeight_Loc, x.height);
    gl.uniform1i(this.wWidth_Loc, y.width);

    // Bind the single, reusable FBO and attach the destination texture.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, y.texture, 0);
    gl.viewport(0, 0, y.width, y.height); // Ensure viewport matches texture size

    // It's good practice to check FBO status after attaching a new texture.
    const fboStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (fboStatus !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer not complete after attaching texture: ' + fboStatus);
    }

    // Activate textures and assign uniforms
    gl.activeTexture(gl.TEXTURE0); // w
    gl.bindTexture(gl.TEXTURE_2D, w.texture);
    gl.uniform1i(this.matrixW_Loc, 0);

    gl.activeTexture(gl.TEXTURE1); // x
    gl.bindTexture(gl.TEXTURE_2D, x.texture);
    gl.uniform1i(this.matrixX_Loc, 1);

    gl.activeTexture(gl.TEXTURE2); // b
    gl.bindTexture(gl.TEXTURE_2D, b.texture);
    gl.uniform1i(this.matrixB_Loc, 2);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Draw the quad
  }
}

class _ABCProgram {
  /**
   * 
   * @param {Context!} context 
   * @param {WebGLProgram!} program 
   */
  constructor(context, program) {
    /** @type {WebGLProgram} */
    this.program = program;
    this.context = context;
    const gl = context.gl;
  }

  _preambleABC() {
    const gl = this.context.gl;
    gl.useProgram(this.program);
    gl.disable(gl.BLEND);

  }

  _postambleABC(a, matrixA_Loc, b, matrixB_Loc, c) {
    const gl = this.context.gl;
    const fbo = this.context.fbo;
    // Bind the single, reusable FBO and attach the destination texture.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, c.texture, 0);
    gl.viewport(0, 0, c.width, c.height); // Ensure viewport matches texture size

    // It's good practice to check FBO status after attaching a new texture.
    const fboStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (fboStatus !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer not complete after attaching texture: ' + fboStatus);
    }

    // Activate textures and assign uniforms
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, a.texture);
    gl.uniform1i(matrixA_Loc, 0); // texture unit 0

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, b.texture);
    gl.uniform1i(matrixB_Loc, 1); // texture unit 1

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Draw the quad
  }
}

class _MatrixMultiplyProgram extends _ABCProgram {
  /**
   * 
   * @param {Context!} context 
   * @param {WebGLProgram!} program 
   */
  constructor(context, program) {
    super(context, program);
    const gl = context.gl;
    this.matrixA_Loc = gl.getUniformLocation(program, 'matrixA');
    this.matrixB_Loc = gl.getUniformLocation(program, 'matrixB');
    this.aWidthLoc = gl.getUniformLocation(program, 'A_width');
    this.aHeightLoc = gl.getUniformLocation(program, 'A_height');
    this.bWidthLoc = gl.getUniformLocation(program, 'B_width');
  }
  /**
   * 
   * @param {LogicalMatrix!} a 
   * @param {LogicalMatrix!} b 
   * @param {LogicalMatrix!} c 
   */
  execute(a, b, c) {
    const gl = this.context.gl;
    this._preambleABC();

    gl.uniform1i(this.aWidthLoc, a.width);
    gl.uniform1i(this.aHeightLoc, a.height);
    gl.uniform1i(this.bWidthLoc, b.width);

    this._postambleABC(a, this.matrixA_Loc, b, this.matrixB_Loc, c);
  }
}

class _MatrixMultiplyT1Program extends _ABCProgram {
  /**
   * 
   * @param {Context!} context 
   * @param {WebGLProgram!} program 
   */
  constructor(context, program) {
    super(context, program);
    /** @type {WebGLProgram} */
    this.program = program;
    this.context = context;
    const gl = context.gl;
    this.matrixA_Loc = gl.getUniformLocation(program, 'matrixA');
    this.matrixB_Loc = gl.getUniformLocation(program, 'matrixB');
    this.aWidthLoc = gl.getUniformLocation(program, 'A_width');
    this.aHeightLoc = gl.getUniformLocation(program, 'A_height');
    this.bWidthLoc = gl.getUniformLocation(program, 'B_width');
  }

  /**
 * 
 * @param {LogicalMatrix!} a 
 * @param {LogicalMatrix!} b 
 * @param {LogicalMatrix!} c 
 */
  execute(a, b, c) {
    const gl = this.context.gl;
    this._preambleABC();

    gl.uniform1i(this.aWidthLoc, a.width);
    gl.uniform1i(this.aHeightLoc, a.height);
    gl.uniform1i(this.bWidthLoc, b.width);

    this._postambleABC(a, this.matrixA_Loc, b, this.matrixB_Loc, c);
  }
}

class _MatrixMultiplyT2Program extends _MatrixMultiplyProgram {
  /**
   * 
   * @param {Context!} context 
   * @param {WebGLProgram!} program 
   */
  constructor(context, program) {
    super(context, program);
    /** @type {WebGLProgram} */ this.program = program;
    this.context = context;
    const gl = context.gl;

    this.matrixA_Loc = gl.getUniformLocation(program, 'matrixA');
    this.matrixB_Loc = gl.getUniformLocation(program, 'matrixB');
    this.aWidthLoc = gl.getUniformLocation(program, 'A_width');
    this.aHeightLoc = gl.getUniformLocation(program, 'A_height');
    this.bHeightLoc = gl.getUniformLocation(program, 'B_height');
  }
  /**
   * 
   * @param {LogicalMatrix!} a 
   * @param {LogicalMatrix!} b 
   * @param {LogicalMatrix!} c 
   */
  execute(a, b, c) {
    const gl = this.context.gl;
    this._preambleABC();

    gl.uniform1i(this.aWidthLoc, a.width);
    gl.uniform1i(this.aHeightLoc, a.height);
    gl.uniform1i(this.bHeightLoc, b.height);

    this._postambleABC(a, this.matrixA_Loc, b, this.matrixB_Loc, c);
  }
}


class _MatrixLossProgram extends _ABCProgram {
  /**
   * 
   * @param {Context!} context 
   * @param {WebGLProgram!} program 
   */
  constructor(context, program) {
    super(context, program);
    /** @type {WebGLProgram} */ this.program = program;
    this.context = context;
    const gl = context.gl;
    this.k = 100.0;  // Pointiness factor.

    this.matrixExpected_Loc = gl.getUniformLocation(program, 'matrixExpected');
    this.matrixActual_Loc = gl.getUniformLocation(program, 'matrixActual');
    this.k_Loc = gl.getUniformLocation(program, 'k');
    if (!this.matrixExpected_Loc || !this.matrixActual_Loc) {
      throw new Error("Missing uniform location in loss program.");
    }
  }
  /**
   * 
   * @param {LogicalMatrix!} expected
   * @param {LogicalMatrix!} actual
   * @param {LogicalMatrix!} loss
   */
  execute(expected, actual, loss) {
    const gl = this.context.gl;
    this._preambleABC();
    gl.uniform1i(this.k_Loc, this.k);
    this._postambleABC(expected, this.matrixExpected_Loc, actual, this.matrixActual_Loc, loss);
  }
}

class _MatrixUpdateProgram {
  /**
   * 
   * @param {Context!} context 
   * @param {WebGLProgram!} program 
   */
  constructor(context, program) {
    /** @type {WebGLProgram} */
    this.program = program;
    this.context = context;
    const gl = context.gl;
    this.matrixY_Loc = gl.getUniformLocation(program, 'matrixY');
    this.matrixA_Loc = gl.getUniformLocation(program, 'matrixA');
    this.alpha_Loc = gl.getUniformLocation(program, 'alpha');
    this.widthLoc = gl.getUniformLocation(program, 'width');
    this.heightLoc = gl.getUniformLocation(program, 'height');
  }

  /**
   * Implements Y = Y + alpha * A
   * @param {LogicalMatrix!} a 
   * @param {number} alpha
   * @param {LogicalMatrix!} y 
   */
  execute(a, alpha, y) {
    if (y.width !== a.width || y.height !== a.height) {
      throw new Error(`Matrix dimensions mismatch: Y (${y.width}x${y.height}) and A (${a.width}x${a.height}) must be the same size.`);
    }

    const gl = this.context.gl;
    const fbo = this.context.fbo;
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.uniform1i(this.widthLoc, a.width);
    gl.uniform1i(this.heightLoc, a.height);
    gl.uniform1f(this.alpha_Loc, alpha);

    // Bind the single, reusable FBO and attach the destination texture.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, y.texture, 0);
    gl.viewport(0, 0, a.width, a.height); // Ensure viewport matches texture size

    // It's good practice to check FBO status after attaching a new texture.
    const fboStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (fboStatus !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer not complete after attaching texture: ' + fboStatus);
    }

    // Activate textures and assign uniforms
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, a.texture);
    gl.uniform1i(this.matrixA_Loc, 0); // texture unit 0

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Draw the quad
  }
}
