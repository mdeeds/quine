#version 300 es // Use WebGL 2.0 compatible version

precision mediump float; // Good practice for precision

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
  // const int W_height = X_width;
#define W_height X_width

  // Determine the current row and column of the output matrix Y
  // texCoord.x maps to column, texCoord.y maps to row
  // Output matrix Y has dimensions X_height x W_width
  // Do not subtract 0.5 here for the half-texel offset; trunc does the right thing.
  int colY = int(texCoord.x * float(W_width)); 
  int rowY = int(texCoord.y * float(X_height));

  // Calculate the starting texture coordinates for k=0, sampling the center of the texel.
  vec2 texCoordX = vec2(0.5 / float(X_width),
                        (float(rowY) + 0.5) / float(X_height));
  vec2 texCoordW = vec2((float(colY) + 0.5) / float(W_width),
                        0.5 / float(W_height));

  // Pre-calculate the increments for the texture coordinates to avoid division in the loop.
  // d_texCoordX corresponds to moving 1 step in k (the x-direction for matrix X).
  vec2 d_texCoordX = vec2(1.0 / float(X_width), 0.0);
  // d_texCoordW corresponds to moving 1 step in k (the y-direction for matrix W).
  vec2 d_texCoordW = vec2(0.0, 1.0 / float(W_height));

  // The output matrix is the same width as the bias, so we choose the bias
  // using the input coordinate.
  vec2 texCoordB = vec2(texCoord.x, 0.5);

  // Start the sum with the bias. It is in red channel of matrixB
  float sum = texture(matrixB, texCoordB).r;
  // Perform the dot product for the current element Y[colY][rowY]
  for (int k = 0; k < X_width; ++k) {
      float elementX = texture(matrixX, texCoordX).r;
      float elementW = texture(matrixW, texCoordW).r;
      sum += elementX * elementW;

      // Increment coordinates for the next iteration
      texCoordX += d_texCoordX;
      texCoordW += d_texCoordW;
  }

  // If sum is undefined or NaN, set it to 255.0
  if (isnan(sum)) {
    sum = 255.0;
  }

  // Output the computed element.  Output should be F16R
  fragColor = vec4(sum, 0.0, 0.0, 1.0); // Store only in red channel for R32F texture    
}