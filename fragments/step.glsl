#version 300 es // Use WebGL 2.0 compatible version

#define PI 3.14159265359
#define HALF_PI 1.57079632679


precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

uniform sampler2D matrix;

out vec4 fragColor; // Output color (the computed matrix element)

// Implements the derivitive of RELU as a soft step
// Y = STEP(X)


float softStep(float x) {
  const float x0 = -3.0;
  const float y0 = atan(x0);
  const float yMax = HALF_PI - y0;
  return atan(x - x0) / yMax;
}

float hardStep(float x) {
  if (x <= 0.0) return 0.1;
  return 1.0;
}

void main() {
  float x = texture(matrix, texCoord).r;
  fragColor = vec4(hardStep(x), 0.0, 0.0, 1.0);
}
