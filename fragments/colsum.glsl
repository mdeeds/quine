#version 300 es // Use WebGL 2.0 compatible version

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

////////////////////////////////////
// Y = colsum(A)
// Column sum of a matrix
////////////////////////////////////
uniform sampler2D matrixA; // Texture containing matrix A
// Height of the matrix
uniform int A_height;

out vec4 fragColor; // Output color (the computed column sum)

void main() {
    float sum = 0.0;

    // Pre-calculate the increment for the texture coordinates to avoid division in the loop.
    // d_texCoordA corresponds to moving 1 step in y (the y-direction for matrix A).
    vec2 d_texCoordA = vec2(0.0, 1.0 / float(A_height));

    // Calculate the starting texture coordinates for row=0, sampling the center of the texel.
    // Matrix A and the output have the same width, so we can use texCoord.x for both.
    vec2 texCoordA = vec2(texCoord.x, 0.5 / float(A_height));

    // Perform the sum for the current column
    for (int row = 0; row < A_height; ++row) {
        float elementA = texture(matrixA, texCoordA).r;
        sum += elementA;

        // Increment coordinates for the next iteration
        texCoordA += d_texCoordA;
    }

  fragColor = vec4(sum, 0.0, 0.0, 1.0); // Store only in red channel for R32F texture
}
