#version 300 es // Use WebGL 2.0 compatible version

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

uniform sampler2D matrixA; // Texture containing matrix A
uniform sampler2D matrixB; // Texture containing matrix B
uniform int matrixSize;    // Size of the square matrices (e.g., 64 for 64x64)

out vec4 fragColor; // Output color (the computed matrix element)

void main() {
    // Determine the current row and column of the output matrix C
    // texCoord.x maps to column, texCoord.y maps to row
    int colC = int(texCoord.x * float(matrixSize));
    int rowC = int(texCoord.y * float(matrixSize));

    float sum = 0.0;

  // Perform the dot product for the current element C[rowC][colC]
  // C[i][j] = sum(A[i][k] * B[k][j]) for k from 0 to matrixSize-1
  for (int k = 0; k < matrixSize; ++k) {
        // Get element A[rowC][k] from matrixA
        // Texture coordinates for A: (k / matrixSize, rowC / matrixSize)
        vec2 texCoordA = vec2(float(k) / float(matrixSize), float(rowC) / float(matrixSize));
        float elementA = texture(matrixA, texCoordA).r; // Assuming red channel stores the value

        // Get element B[k][colC] from matrixB
        // Texture coordinates for B: (colC / matrixSize, k / matrixSize)
        vec2 texCoordB = vec2(float(colC) / float(matrixSize), float(k) / float(matrixSize));
        float elementB = texture(matrixB, texCoordB).r; // Assuming red channel stores the value

    sum += elementA * elementB;
  }

  // Output the computed element.
  // Store it in the red channel, or all channels if you prefer grayscale.
  fragColor = vec4(sum, 0.0, 0.0, 1.0); // Store only in red channel for R32F texture
}