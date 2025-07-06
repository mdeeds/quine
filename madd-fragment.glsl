#version 300 es // Use WebGL 2.0 compatible version

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

uniform sampler2D matrixA; // Texture containing matrix A
uniform sampler2D matrixB; // Texture containing matrix B
// Width and height of the two matricies
uniform int width;
uniform int height;
uniform float alpha;
uniform float beta;

out vec4 fragColor; // Output color (the computed matrix element)

// Implements Matrix addition (elementwise) 
// C = aA + bB
void main() {
  // Determine the current row and column of the output matrix C
  // texCoord.x maps to column, texCoord.y maps to row
  // Output matrix C has dimensions B_width x A_height
  // Do not subtract 0.5 here for the half-texel offset; trunc does the right thing.
  int row = int(texCoord.y * float(height));
  int col = int(texCoord.x * float(width)); 

  // Calculate the starting texture coordinates for k=0, sampling the center of the texel.
  vec2 texCoord = vec2((float(col) + 0.5) / float(width), 
                       (float(row) + 0.5) / float(height));

  float a = alpha * texture(matrixA, texCoord).r;
  float b = beta * texture(matrixB, texCoord).r;

  fragColor = vec4(a + b, 0.0, 0.0, 1.0);
}
