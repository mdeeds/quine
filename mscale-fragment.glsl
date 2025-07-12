#version 300 es // Use WebGL 2.0 compatible version

precision highp float; // Good practice for precision

in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

////////////////////////////////////
// Y = alpha A
// Note: This is useful for updates of the form:
// Y = Y + alpha A
// To do this, you'll need to have Y as your frame buffer output, and set the blending mode
// appropriately.
////////////////////////////////////
uniform sampler2D matrixA; // Texture containing matrix A
uniform float alpha;

out vec4 fragColor; // Output color (the computed matrix element)

void main() {
  float a = alpha * texture(matrixA, texCoord).r;
  fragColor = vec4(a, 0.0, 0.0, 1.0);
}
