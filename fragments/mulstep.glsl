#version 300 es // Use WebGL 2.0 compatible version

#define RECIP_PI 0.318309886184

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

void main() {
  float a = texture(matrixA, texCoord).r;
  float b = texture(matrixB, texCoord).r;
  // atan has a range of (-PI/2, PI/2), so max-min = PI
  float stepB = atan(k * b) * RECIP_PI + 0.5;
  float y = a * stepB;
  fragColor = vec4(y, 0.0, 0.0, 1.0);
}
