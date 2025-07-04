// @ts-check

class Gpu {
  /**
   * Do not use this constructor. Please use the async create method instead.
   * @param {WebGL2RenderingContext} gl 
   * @param {WebGLFramebuffer} fbo
   */
  constructor(gl, fbo) {
    this.gl = gl;
    /** @type {Context} */
    this.context = new Context(gl, fbo);
    /** @type {_MatrixMultiplyProgram | null} */
    this.mm_program = null;
    /** @type {_MatrixMultiplyAddBiasProgram | null} */
    this.mmab_program = null;
    /** @type {WebGLBuffer | null} */
    this.quadPositionBuffer = null;
    /** @type {WebGLBuffer | null} */
    this.quadTexCoordBuffer = null;
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
   * Cleans up all WebGL resources associated with this Gpu instance.
   */
  destroy() {
    const gl = this.gl;
    if (this.mm_program) {
      this.mm_program.destroy();
      this.mm_program = null;
    }
    if (this.quadPositionBuffer) {
      gl.deleteBuffer(this.quadPositionBuffer);
      this.quadPositionBuffer = null;
    }
    if (this.quadTexCoordBuffer) {
      gl.deleteBuffer(this.quadTexCoordBuffer);
      this.quadTexCoordBuffer = null;
    }
    if (this.context.fbo) {
      gl.deleteFramebuffer(this.context.fbo);
    }
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
    const result = this._createProgram(code);
    if (!result) {
      throw new Error(`Failed to create shader: ${glslPath}`);
    }
    return result;
  }
  /**
   * @returns {Promise<void>}
   */
  async _initialize() {
    this._createQuadBuffers();
    this.mm_program = new _MatrixMultiplyProgram(
      this.context, await this._fetchProgram('mm-fragment.glsl'));
    this.mmab_program = new _MatrixMultiplyAddBiasProgram(
      this.context, await this._fetchProgram('mmab-fragment.glsl'));
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
   * @returns {WebGLProgram | null}
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
    if (!vertexShader || !fragmentShader) return null;

    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program linking error:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      return null;
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
    this.xWidthLoc = gl.getUniformLocation(program, 'X_width');
    this.xHeightLoc = gl.getUniformLocation(program, 'X_height');
    this.wWidthLoc = gl.getUniformLocation(program, 'W_width');
  }

  /**
   * Destroys the program and any associated WebGL resources.
   */
  destroy() {
    if (this.program) {
      this.context.gl.deleteProgram(this.program);
    }
  }

  /**
   * 
   * @param {LogicalMatrix!} x 
   * @param {LogicalMatrix!} w 
   * @param {LogicalMatrix!} b 
   * @param {LogicalMatrix!} y 
   */
  execute(x, w, b, y) {
    const gl = this.context.gl;
    const fbo = this.context.fbo;
    gl.useProgram(this.program);

    gl.uniform1i(this.xWidthLoc, x.width);
    gl.uniform1i(this.xHeightLoc, x.height);
    gl.uniform1i(this.wWidthLoc, w.width);

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
    gl.activeTexture(gl.TEXTURE0); // x
    gl.bindTexture(gl.TEXTURE_2D, x.texture);
    gl.uniform1i(this.matrixX_Loc, 0);

    gl.activeTexture(gl.TEXTURE1); // w
    gl.bindTexture(gl.TEXTURE_2D, w.texture);
    gl.uniform1i(this.matrixW_Loc, 1);

    gl.activeTexture(gl.TEXTURE2); // b
    gl.bindTexture(gl.TEXTURE_2D, b.texture);
    gl.uniform1i(this.matrixB_Loc, 2);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Draw the quad
  }
}

class _MatrixMultiplyProgram {
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
    this.matrixA_Loc = gl.getUniformLocation(program, 'matrixA');
    this.matrixB_Loc = gl.getUniformLocation(program, 'matrixB');
    this.aWidthLoc = gl.getUniformLocation(program, 'A_width');
    this.aHeightLoc = gl.getUniformLocation(program, 'A_height');
    this.bWidthLoc = gl.getUniformLocation(program, 'B_width');
  }

  /**
   * Destroys the program and any associated WebGL resources.
   */
  destroy() {
    if (this.program) {
      this.context.gl.deleteProgram(this.program);
    }
  }

  /**
   * 
   * @param {LogicalMatrix!} a 
   * @param {LogicalMatrix!} b 
   * @param {LogicalMatrix!} c 
   */
  execute(a, b, c) {
    const gl = this.context.gl;
    const fbo = this.context.fbo;
    gl.useProgram(this.program);

    gl.uniform1i(this.aWidthLoc, a.width);
    gl.uniform1i(this.aHeightLoc, a.height);
    gl.uniform1i(this.bWidthLoc, b.width);
    // Note: b.height is equal to a.width, so we do not use a uniform for it.

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
    gl.uniform1i(this.matrixA_Loc, 0); // texture unit 0

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, b.texture);
    gl.uniform1i(this.matrixB_Loc, 1); // texture unit 1

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Draw the quad
  }
}