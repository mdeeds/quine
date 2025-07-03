// @ts-check

class TextureHandle {
  /**
   * @param {WebGLTexture!} texture 
   * @param {number} width 
   * @param {number} height 
   */
  constructor(texture, width, height) {
    this.texture = texture;
    this.width = width;
    this.height = height;
  }
}

class MatrixMultiplyProgram {
  constructor(program) {
    this.program = program;
    this.matrixA_Loc = this.program.getUniformLocation('matrixA');
    this.matrixB_Loc = this.program.getUniformLocation('matrixB');
    this.aWidthLoc = this.program.getUniformLocation('A_width');
    this.aHeightLoc = this.program.getUniformLocation('A_height');
    this.bWidthLoc = this.program.getUniformLocation('B_width');
  }
}

class Gpu {
  /**
   * 
   * @param {WebGL2RenderingContext} gl 
   */
  constructor(gl) {
    this.gl = gl;
  }

  /**
   * @returns {Promise<Gpu!>}
   */
  async create() {
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
    const gpu = new Gpu(gl);
    await gpu._initialize();
    return gpu;
  }

  /**
   * Creates a texture from a Float32Array.
   * @param {Float32Array?} data 
   * @param {number} width 
   * @param {number} height 
   * @returns {TextureHandle!}
   */
  createFloatTexture(data = null, width, height) {
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R32F, width, height, 0,
      this.gl.RED, this.gl.FLOAT, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    return new TextureHandle(texture, width, height);
  }

  /**
   * @param {TextureHandle} texture 
   * @returns {void}
   */
  deleteTexture(texture) {
    this.gl.deleteTexture(texture.texture);
  }

  /**
   * 
   * @param {WebGLTexture!} texture 
   * @returns {WebGLFramebuffer!}
   */
  _createFramebuffer(texture) {
    // Framebuffer Object (FBO) for rendering to textureC
    const fbo = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);

    const fboStatus = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (fboStatus !== this.gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer not complete:', fboStatus);
      throw new Error('Framebuffer not complete: ' + fboStatus);
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); // Unbind FBO
    return fbo;
  }

  /**
   * @param {WebGLFramebuffer} fbo 
   * @returns {void}
   */
  _deleteFramebuffer(fbo) {
    this.gl.deleteFramebuffer(fbo);
  }

  /*********************************
   *      PRIVATE METHODS
   *********************************/

  /**
   * @returns {Promise<void>}
   */
  async _initialize() {
    this.mm_fragment = await (await fetch('mm-fragment.glsl')).text();
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
   * Adds our standard unit quads to the shader program.
   * @param {WebGLProgram} shaderProgram 
   * @returns {BufferInfo!}
   */
  _setupQuad(shaderProgram) {
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
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    const texCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);

    // Set up vertex attribute pointers
    const posAttribLoc = this.gl.getAttribLocation(shaderProgram, 'aPos');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.vertexAttribPointer(posAttribLoc, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(posAttribLoc);

    const texAttribLoc = this.gl.getAttribLocation(shaderProgram, 'aTexCoord');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
    this.gl.vertexAttribPointer(texAttribLoc, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(texAttribLoc);
    return { positionBuffer, texCoordBuffer };
  }


  /**
   * @param {WebGLFramebuffer} fbo 
   * @param {number} width 
   * @param {number} height 
   * @param {WebGLTexture} textureA 
   * @param {WebGLTexture} textureB 
   * @param {WebGLUniformLocation} matrixA_Loc 
   * @param {WebGLUniformLocation} matrixB_Loc 
   * @returns {void}
   */
  computeMatrixProduct(fbo, width, height, textureA, textureB, matrixA_Loc, matrixB_Loc) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo); // Render to textureC
    this.gl.viewport(0, 0, width, height); // Ensure viewport matches texture size

    // Activate textures and assign uniforms
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, textureA);
    this.gl.uniform1i(matrixA_Loc, 0); // texture unit 0

    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, textureB);
    this.gl.uniform1i(matrixB_Loc, 1); // texture unit 1

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4); // Draw the quad
  }

  /**
   * 
   * @param {WebGLFramebuffer} fbo 
   * @param {WebGLTexture} texture 
   * @param {number} width 
   * @param {number} height 
   * @returns {Float32Array}
   */
  readPixels(fbo, texture, width, height) {
    // Bind the final result texture (which is now `textureA` after the last swap)
    // as the source for reading pixels.
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0); // Ensure FBO is pointing to the final A

    const finalResult = new Float32Array(width * height);
    this.gl.readPixels(0, 0, width, height, this.gl.RED, this.gl.FLOAT, finalResult);
    return finalResult;
  }

}

/**
 * @typedef {{positionBuffer: WebGLBuffer, texCoordBuffer: WebGLBuffer}} BufferInfo
 */