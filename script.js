function logInfo(message) {
  const div = document.createElement('div');
  div.innerHTML = message;
  console.log(div.innerText);
}

// Something similar to a guassian.
function rn() {
  return Math.random() - Math.random() + Math.random() - Math.random();
}

async function main() {
  const canvas = document.getElementById('glcanvas');
  const infoDiv = document.getElementById('info');
  const gl = canvas.getContext('webgl2');

  if (!gl) {
    logInfo('<p>Unable to initialize WebGL 2.0. Your browser or hardware may not support it.</p>');
    return;
  }

  // Check for the required extension for rendering to float textures
  const ext = gl.getExtension('EXT_color_buffer_float');
  if (!ext) {
    logInfo(
      '<p>Unable to run: This browser does not support the EXT_color_buffer_float extension, which is required for rendering to float textures.</p>');
    return;
  }

  const MATRIX_SIZE = 64;
  const NUM_ITERATIONS = 10;  // TODO: Increase.
  const FLOAT_BYTES = 4; // float32

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

  // Fetch the fragment shader from the file
  const fsResponse = await fetch('mm-fragment.glsl');
  const fsSource = await fsResponse.text();

  // -------------------------------------------------------------------------
  // Shader Program Setup
  // -------------------------------------------------------------------------

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vsSource, fsSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  const shaderProgram = createProgram(gl, vsSource, fsSource);
  if (!shaderProgram) {
    logInfo('<p>Failed to create shader program.</p>');
    return;
  }

  gl.useProgram(shaderProgram);

  // Get uniform locations
  const matrixA_Loc = gl.getUniformLocation(shaderProgram, 'matrixA');
  const matrixB_Loc = gl.getUniformLocation(shaderProgram, 'matrixB');
  const matrixSize_Loc = gl.getUniformLocation(shaderProgram, 'matrixSize');

  // Set matrix size uniform once
  gl.uniform1i(matrixSize_Loc, MATRIX_SIZE);

  // -------------------------------------------------------------------------
  // Quad Setup (to draw full screen)
  // -------------------------------------------------------------------------

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

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

  // Set up vertex attribute pointers
  const posAttribLoc = gl.getAttribLocation(shaderProgram, 'aPos');
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(posAttribLoc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(posAttribLoc);

  const texAttribLoc = gl.getAttribLocation(shaderProgram, 'aTexCoord');
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.vertexAttribPointer(texAttribLoc, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(texAttribLoc);

  // -------------------------------------------------------------------------
  // Texture and FBO Setup
  // -------------------------------------------------------------------------

  // Helper to create a float texture
  function createFloatTexture(gl, data = null) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, MATRIX_SIZE, MATRIX_SIZE, 0, gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  // Initialize matrices with some dummy data
  const matrixA_data = new Float32Array(MATRIX_SIZE * MATRIX_SIZE);
  const matrixB_data = new Float32Array(MATRIX_SIZE * MATRIX_SIZE);
  // Example: Populate matrices (e.g., identity and a constant matrix)
  for (let i = 0; i < MATRIX_SIZE; i++) {
    for (let j = 0; j < MATRIX_SIZE; j++) {
      const index = i * MATRIX_SIZE + j;
      matrixA_data[index] = rn();
      matrixB_data[index] = rn();
      // matrixA_data[index] = (i === j) ? 1.0 : 0.0;  // Identity
      // matrixB_data[index] = matrixA_data[index];
    }
  }

  let textureA = createFloatTexture(gl, matrixA_data);
  let textureB = createFloatTexture(gl, matrixB_data);
  let textureC = createFloatTexture(gl); // This will be the output texture

  // Framebuffer Object (FBO) for rendering to textureC
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureC, 0);

  const fboStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (fboStatus !== gl.FRAMEBUFFER_COMPLETE) {
    console.error('Framebuffer not complete:', fboStatus);
    logInfo('<p>Framebuffer setup failed.</p>');
    return;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind FBO

  // -------------------------------------------------------------------------
  // The main computation loop
  // -------------------------------------------------------------------------

  logInfo(`<p>WebGL Matrix Multiplication (64x64)</p><p>Status: Computing (0/${NUM_ITERATIONS})...</p>`);

  const startTime = performance.now();

  for (let i = 0; i < NUM_ITERATIONS; ++i) {
    // 1. Compute C = A * B
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); // Render to textureC
    gl.viewport(0, 0, MATRIX_SIZE, MATRIX_SIZE); // Ensure viewport matches texture size

    // Activate textures and assign uniforms
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureA);
    gl.uniform1i(matrixA_Loc, 0); // texture unit 0

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textureB);
    gl.uniform1i(matrixB_Loc, 1); // texture unit 1

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Draw the quad

    // 2. Assign A = C (swap textures)
    // To make A = C, we effectively swap the texture references.
    // The texture that was 'C' (textureC) now becomes 'A' for the next iteration.
    // The texture that was 'A' (textureA) now becomes the new 'C' (output target).
    // This avoids copying data back and forth.
    let tempTexture = textureA;
    textureA = textureC; // A is now the result of the last multiplication
    textureC = tempTexture; // The old A is now the target for the next C

    // Re-attach the new textureC to the FBO for the next iteration's output
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureC, 0);

    logInfo(`<p>WebGL Matrix Multiplication (64x64)</p><p>Status: Computing (${i + 1}/${NUM_ITERATIONS})...</p>`);
  }

  const endTime = performance.now();
  const computationTime = (endTime - startTime).toFixed(2);
  logInfo(`<p>WebGL Matrix Multiplication (64x64)</p><p>Status: Computation complete.</p><p>Time: ${computationTime} ms</p><p>Reading result from GPU...</p>`);

  // -------------------------------------------------------------------------
  // Read the final matrix back to CPU
  // -------------------------------------------------------------------------

  // Bind the final result texture (which is now `textureA` after the last swap)
  // as the source for reading pixels.
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureA, 0); // Ensure FBO is pointing to the final A

  const finalResult = new Float32Array(MATRIX_SIZE * MATRIX_SIZE);
  gl.readPixels(0, 0, MATRIX_SIZE, MATRIX_SIZE, gl.RED, gl.FLOAT, finalResult);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind FBO
  gl.deleteFramebuffer(fbo); // Clean up FBO
  gl.deleteTexture(textureB); // Clean up unused textureB
  gl.deleteTexture(textureC); // Clean up the final textureC (which was the temp A)

  console.log(`Final Matrix (A) after ${NUM_ITERATIONS} iterations:`);
  // Print a small part of the matrix to verify
  for (let i = 0; i < Math.min(MATRIX_SIZE, 5); i++) {
    let row = [];
    for (let j = 0; j < Math.min(MATRIX_SIZE, 5); j++) {
      row.push(finalResult[i * MATRIX_SIZE + j].toFixed(4));
    }
    console.log(row.join(', '));
  }
  console.log("...");

  logInfo(`<p>WebGL Matrix Multiplication (64x64)</p><p>Status: Done!</p><p>Time: ${computationTime} ms</p><p>Check console for results.</p>`);

  const cc = float32ToCanvas(finalResult, MATRIX_SIZE);
  infoDiv.appendChild(cc);
}

function float32ToCanvas(values, width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(values.length / width);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, canvas.height);
  let maxValue = 0;
  let minValue = 0;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value > maxValue) maxValue = value;
    if (value < minValue) minValue = value;

  }

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const pixelIndex = i * 4; // Each pixel has 4 components (R, G, B, A)

    if (value > 0) {
      // Red channel for positive values
      const intensity = value / maxValue;
      imageData.data[pixelIndex + 0] = Math.floor(intensity * 255); // Red
      imageData.data[pixelIndex + 1] = 0; // Green
      imageData.data[pixelIndex + 2] = 0; // Blue
    } else {
      // Blue channel for negative values
      const intensity = value / minValue; // minValue is negative, so this will be positive
      imageData.data[pixelIndex + 0] = 0; // Red
      imageData.data[pixelIndex + 1] = 0; // Green
      imageData.data[pixelIndex + 2] = Math.floor(intensity * 255); // Blue
    }
    imageData.data[pixelIndex + 3] = 255; // Alpha (fully opaque)
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

main();