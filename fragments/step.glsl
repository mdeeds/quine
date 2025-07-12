#version 300 es // Use WebGL 2.0 compatible version

#define PI 3.14159265359

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

uniform sampler2D matrix;

out vec4 fragColor; // Output color (the computed matrix element)

// Implements the derivitive of RELU as a soft step
// Y = STEP(X)
void main() {
  float x = texture(matrix, texCoord).r;
  float r = (atan(x) / PI) + 0.5;
  fragColor = vec4(r, 0.0, 0.0, 1.0);
}
