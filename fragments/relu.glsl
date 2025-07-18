#version 300 es // Use WebGL 2.0 compatible version

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

uniform sampler2D matrix;

out vec4 fragColor; // Output color (the computed matrix element)

// Implements Matrix addition (elementwise) 
// Y = RELU(X)
void main() {
  float r = max(0.0, texture(matrix, texCoord).r);
  fragColor = vec4(r, 0.0, 0.0, 1.0);
}
