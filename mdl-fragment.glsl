#version 300 es // Use WebGL 2.0 compatible version

#define HALF_PI 1.57079632679
#define RECIP_HALF_PI 0.636619772368

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

uniform sampler2D matrixExpected; // Texture containing matrix A
uniform sampler2D matrixActual; // Texture containing matrix B

out vec4 fragColor; // Output color (the computed matrix element)

// Implements dLoss - the derivitive of our loss function comparing expected to actual outputs.
// dL = atan(expected - actual)
void main() {
  // Everything is the same shape, so we can use the texCoord varying directly.
  float expected = texture(matrixExpected, texCoord).r;
  float actual = texture(matrixActual, texCoord).r;
  float error = expected - actual;

  fragColor = vec4(RECIP_HALF_PI * atan(error * 100.0), 0.0, 0.0, 1.0);
}
