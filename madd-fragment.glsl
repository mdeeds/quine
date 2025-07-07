#version 300 es // Use WebGL 2.0 compatible version

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

uniform sampler2D matrixA; // Texture containing matrix A
uniform sampler2D matrixB; // Texture containing matrix B
// Width and height of the two matricies
uniform float alpha;
uniform float beta;

out vec4 fragColor; // Output color (the computed matrix element)

// Implements Matrix addition (elementwise) 
// C = aA + bB
void main() {
  float a = alpha * texture(matrixA, texCoord).r;
  float b = beta * texture(matrixB, texCoord).r;

  fragColor = vec4(a + b, 0.0, 0.0, 1.0);
}
