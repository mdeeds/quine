#version 300 es // Use WebGL 2.0 compatible version

#define RECIP_PI 0.318309886184
#define HALF_PI 1.57079632679

precision highp float; // Good practice for precision
in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

////////////////////////////////////
// Y = A (.) STEP(k * B)
// where STEP is a smooth step function (atan based); range = (0, 1)
// The (.) operator is an elementwise multipliaction.
////////////////////////////////////
uniform sampler2D matrixA; // Texture containing matrix A
uniform sampler2D matrixB; // Texture containing matrix B
uniform float k;  // peakiness of the step function

out vec4 fragColor; // The computed matrix element of Y

float softStep(float x) {
  const float x0 = -3.0;
  const float y0 = atan(x0);
  // atan has a range of (-PI/2, PI/2) so max is PI/2 - y0
  const float yMax = HALF_PI - y0;
  return abs(atan(x - x0) / yMax);
}

float hardStep(float x) {
  if (x <= 0.0) return 0.1;
  return 1.0;
}

void main() {
  float a = texture(matrixA, texCoord).r;
  float b = texture(matrixB, texCoord).r;

  float stepB = softStep(k * b);
  float y = a * stepB;
  fragColor = vec4(y, 0.0, 0.0, 1.0);
}
