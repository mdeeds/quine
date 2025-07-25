#version 300 es

precision mediump float;

in vec2 texCoord;

////////////////////////////////////
// Y = rowmean(A)
//
// Computes the mean of each row in matrix A.
// For an input matrix A of size M x N, the output Y is a
// column vector (an M x 1 matrix).
////////////////////////////////////

uniform sampler2D matrixA;
uniform int A_width;

out vec4 fragColor;

void main() {
    // The output is an M x 1 matrix (a column vector).
    // texCoord.y corresponds to the row index.
    // texCoord.x is effectively constant since the output width is 1.

    // Calculate the starting texture coordinate for the first element (k=0)
    // of the current row in matrix A, sampling the center of the texel.
    vec2 texCoordA = vec2(0.5 / float(A_width), texCoord.y);

    // Pre-calculate the increment for the x-coordinate to step through the row.
    vec2 d_texCoordA = vec2(1.0 / float(A_width), 0.0);

    // Sum up all elements in the current row.
    float sum = 0.0;
    for (int k = 0; k < A_width; ++k) {
        sum += texture(matrixA, texCoordA).r;
        texCoordA += d_texCoordA;
    }

    // Calculate the mean by dividing by the number of elements in the row.
    float mean = sum / float(A_width);

    fragColor = vec4(mean, 0.0, 0.0, 1.0);
}

