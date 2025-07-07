#version 300 es // Use WebGL 2.0 compatible version
#define RECIP_HALF_PI 0.636619772368
#define MAX_VALUE 5.0
#define RECIP_MAX_VALUE (1.0 / MAX_VALUE)

// Note: This is useful for updates of the form:
// Y = Y + alpha atan(A)
// To do this, you'll need to have Y as your frame buffer output, and set the blending mode
// appropriately.

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

uniform sampler2D matrixA; // Texture containing matrix A
uniform float alpha;

out vec4 fragColor; // Output color (the computed matrix element)

// Implements matrix scaling (elementwise) 
// Y = alpha atan(A)
void main() {

  float a = alpha * RECIP_HALF_PI * MAX_VALUE * 
    atan(RECIP_MAX_VALUE * texture(matrixA, texCoord).r);
  fragColor = vec4(a, 0.0, 0.0, 1.0);
}
