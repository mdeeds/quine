#version 300 es // Use WebGL 2.0 compatible version

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

////////////////////////////////////
// Y = X W + B
// Computes a matrix multiply and adds a bias vector.
////////////////////////////////////
uniform sampler2D matrixX; // Texture containing matrix X
uniform sampler2D matrixW; // Texture containing matrix W
uniform sampler2D matrixB; // Texture containing matrix B
// Width and height of the two matricies
uniform int X_width;
uniform int X_height;
uniform int W_width;
// Note: X_width === W_height
// Note: W_width === B_width
// Note: B_height = 1

out vec4 fragColor; // Output color (the computed matrix element)

// Implements Matrix multipliaction and adds a bias vector.
void main() {
  // Determine the current row and column of the output matrix Y
  // texCoord.x maps to column, texCoord.y maps to row
  // Output matrix Y has dimensions X_width x W_height
  // Subtract 0.5 here for the half-texel offset
  int rowY = int(texCoord.y * float(W_height) - 0.5);
  int colY = int(texCoord.x * float(X_width) - 0.5); 

  int W_height = X_width;

  // Pre-calculate the increments for the texture coordinates to avoid division in the loop.
  // d_texCoordX corresponds to moving 1 step in k (the y-direction for matrix X).
  vec2 d_texCoordX = vec2(1.0 / float(X_width), 0.0);
  // d_texCoordW corresponds to moving 1 step in k (the x-direction for matrix W).
  vec2 d_texCoordW = vec2(0.0, 1.0 / float(W_height));

  // Calculate the starting texture coordinates for k=0, sampling the center of the texel.
  vec2 texCoordX = vec2(0.5 / float(X_width),
                        (float(rowY) + 0.5) / float(X_height));
  vec2 texCoordW = vec2((float(colY) + 0.5) / float(W_width),
                        0.5 / float(W_height));
  // The output matrix is the same width as the bias, so we choose the bias
  // using the input coordinate.
  vec2 texCoordB = vec2(texCoord.x, 0.5);

  // Start the sum with the bias. It is in red channel of matrixB
  float sum = texture(matrixB, texCoordB).r;
  // Perform the dot product for the current element Y[colY][rowY]
  for (int k = 0; k < W_width; ++k) {
      float elementX = texture(matrixX, texCoordX).r;
      float elementW = texture(matrixW, texCoordW).r;
      sum += elementX * elementW;

      // Increment coordinates for the next iteration
      texCoordX += d_texCoordX;
      texCoordW += d_texCoordW;
  }

  // Output the computed element.  Output should be F16R
  fragColor = vec4(sum, 0.0, 0.0, 1.0); // Store only in red channel for R32F texture    
}