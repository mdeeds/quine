#version 300 es

precision mediump float;

in vec2 texCoord;

////////////////////////////////////
// Y = row_stddev(A, mean(A))
//
// Computes the standard deviation of each row in matrix A.
// It requires the pre-computed row-wise mean of A.
// For an input matrix A of size M x N, the output Y is a
// column vector (an M x 1 matrix).
////////////////////////////////////

uniform sampler2D matrixA;
uniform sampler2D matrixMean;
uniform int A_width;

out vec4 fragColor;

void main() {
    // The output is an M x 1 matrix (a column vector).
    // texCoord.y corresponds to the row index.

    // Get the pre-computed mean for this row. The mean matrix is M x 1.
    float mean = texture(matrixMean, vec2(0.5, texCoord.y)).r;

    // Calculate the starting texture coordinate for the first element (k=0)
    // of the current row in matrix A, sampling the center of the texel.
    vec2 texCoordA = vec2(0.5 / float(A_width), texCoord.y);
    vec2 d_texCoordA = vec2(1.0 / float(A_width), 0.0);

    // Sum the squared differences from the mean.
    float sum_of_squares = 0.0;
    for (int k = 0; k < A_width; ++k) {
        float a = texture(matrixA, texCoordA).r;
        float diff = a - mean;
        sum_of_squares += diff * diff;
        texCoordA += d_texCoordA;
    }

    // Calculate population variance and then the standard deviation.
    float variance = sum_of_squares / float(A_width);
    float sd = sqrt(variance);

    fragColor = vec4(sd, 0.0, 0.0, 1.0);
}