#version 300 es // Use WebGL 2.0 compatible version

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

////////////////////////////////////
// Y = A B
// Matrix multiplication
////////////////////////////////////
uniform sampler2D matrixA; // Texture containing matrix A
uniform sampler2D matrixB; // Texture containing matrix B
// Width and height of the two matricies
uniform int A_width;
uniform int A_height;
uniform int B_width;
// Note: A_width === B_height

out vec4 fragColor; // Output color (the computed matrix element)

void main() {
    // Determine the current row and column of the output matrix C
    // texCoord.x maps to column, texCoord.y maps to row
    // Output matrix C has dimensions B_width x A_height
    // Do not subtract 0.5 here for the half-texel offset; trunc does the right thing.
    int rowC = int(texCoord.y * float(A_height));
    int colC = int(texCoord.x * float(B_width)); 

    float sum = 0.0;
    int B_height = A_width;

    // Pre-calculate the increments for the texture coordinates to avoid division in the loop.
    // d_texCoordA corresponds to moving 1 step in k (the x-direction for matrix A).
    vec2 d_texCoordA = vec2(1.0 / float(A_width), 0.0);
    // d_texCoordB corresponds to moving 1 step in k (the y-direction for matrix B).
    vec2 d_texCoordB = vec2(0.0, 1.0 / float(B_height));

    // Calculate the starting texture coordinates for k=0, sampling the center of the texel.
    vec2 texCoordA = vec2(0.5 / float(A_width), (float(rowC) + 0.5) / float(A_height));
    vec2 texCoordB = vec2((float(colC) + 0.5) / float(B_width), 0.5 / float(B_height));

    // Perform the dot product for the current element C[colC][rowC]
    for (int kk = 0; kk < A_width; ++kk) {
        float elementA = texture(matrixA, texCoordA).r;
        float elementB = texture(matrixB, texCoordB).r;
        sum += elementA * elementB;

        // Increment coordinates for the next iteration
        texCoordA += d_texCoordA;
        texCoordB += d_texCoordB;
    }

  fragColor = vec4(sum, 0.0, 0.0, 1.0); // Store only in red channel for R32F texture
}
