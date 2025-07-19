#version 300 es // Use WebGL 2.0 compatible version

#define HALF_PI 1.57079632679
#define RECIP_HALF_PI 0.636619772368

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

////////////////////////////////////
// Y = atan(k(actual - expected)) / (PI/2)
// Computes the derivitive of the loss function (I.e. dL)
// `k` is a parameter to adjust how sharp the point is around the origin.
// Higher values are more sharp.
// The range is (-1, 1)
////////////////////////////////////
uniform sampler2D matrixExpected; // Texture containing expected matrix
uniform sampler2D matrixActual; // Texture containing actual matrix
uniform float k;

out vec4 fragColor; // Output color (the computed matrix element)

void main() {
  // Everything is the same shape, so we can use the texCoord varying directly.
  float expected = texture(matrixExpected, texCoord).r;
  float actual = texture(matrixActual, texCoord).r;
  float error = actual - expected;

  fragColor = vec4(RECIP_HALF_PI * atan(error * k), 0.0, 0.0, 1.0);
  
}
