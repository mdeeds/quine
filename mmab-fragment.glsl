#version 300 es // Use WebGL 2.0 compatible version

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

uniform sampler2D matrixW; // Texture containing matrix W
uniform sampler2D matrixX; // Texture containing matrix X
uniform sampler2D matrixB; // Texture containing matrix B
// Width and height of the two matricies
uniform int W_width;
uniform int W_height;
uniform int X_width;
// Note: W_width === X_height === B_width
// Note: B_height = 1

out vec4 fragColor; // Output color (the computed matrix element)

// Implements Matrix multipliaction and adds a bias vector.
// Y = W X + B
void main() {
    // Determine the current row and column of the output matrix Y
    // texCoord.x maps to column, texCoord.y maps to row
    // Output matrix Y has dimensions X_width x W_height
    // Subtract 0.5 here for the half-texel offset
    int rowY = int(texCoord.y * float(W_height) - 0.5);
    int colY = int(texCoord.x * float(X_width) - 0.5); 

    int X_height = W_width;

    // Pre-calculate the increments for the texture coordinates to avoid division in the loop.
    // d_texCoordW corresponds to moving 1 step in k (the x-direction for matrix W).
    vec2 d_texCoordW = vec2(1.0 / float(W_width), 0.0);
    // d_texCoordX corresponds to moving 1 step in k (the y-direction for matrix X).
    vec2 d_texCoordX = vec2(0.0, 1.0 / float(X_height));

    // Calculate the starting texture coordinates for k=0, sampling the center of the texel.
    vec2 texCoordW = vec2(0.5 / float(W_width), (float(rowY) + 0.5) / float(W_height));
    vec2 texCoordX = vec2((float(colY) + 0.5) / float(X_width), 0.5 / float(X_height));

    // X is the same width as the bias, so we choose the bias using the column
    // of the X matrix.
    vec2 texCoordB = vec2(texCoordX.x, 0.5);
    float sum = texture(matrixB, texCoordB).r; // Bias is in the red channel of matrixB

    // Perform the dot product for the current element Y[colY][rowY]
    for (int k = 0; k < W_width; ++k) {
        float elementW = texture(matrixW, texCoordW).r;
        float elementX = texture(matrixX, texCoordX).r;
        sum += elementW * elementX;

        // Increment coordinates for the next iteration
        texCoordW += d_texCoordW;
        texCoordX += d_texCoordX;
    }

  // Output the computed element.
  // Store it in the red channel, or all channels if you prefer grayscale.
  fragColor = vec4(sum, 0.0, 0.0, 1.0); // Store only in red channel for R32F texture    
}