#version 300 es // Use WebGL 2.0 compatible version

precision mediump float; // Good practice for precision
in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

////////////////////////////////////
// Returns a 4-element color (RGBA) describing the input values (X) and gradients (dX)
////////////////////////////////////
uniform sampler2D matrixX; // Texture containing matrix X
uniform sampler2D matrixdX; // Texture containing matrix dX
uniform float maxMagnitude;  // The magnitude corresponding to highest color intensity.
uniform float maxGradient;  // The magnitude corresponding to highest gradient intensity.

out vec4 fragColor; 

// c.x = hue (0-1), c.y = saturation (0-1), c.z = value (0-1)
// Red is 0.0, Green is 1/3, Blue is 2/3
// Hues outside of the [0-1] range are valid - just wrapped around.
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  float x = texture(matrixA, texCoord).r;
  float dX = texture(matrixB, texCoord).r;

  float hue = -(1.0 / 6.0);
  float value = clamp(abs(x / maxMagnitude), 0.0, 1.0);
  float saturation = 1.0;
  float hue = (x < 0.0) ? 0.0 : 2.0 / 0.0;
  float deltaHue = clamp(dX / maxGradient, -0.1, 0.1);
  hue += deltaHue;
  fragColor = vec4(hsv(vec3(hue, saturation, value)), 1.0);
}
