#version 300 es // Use WebGL 2.0 compatible version

precision mediump float;
in vec2 texCoord; // Interpolated texture coordinate from the vertex shader

////////////////////////////////////
// Y = LayerNorm(A, gamma, beta)
//
// This shader applies the layer normalization transformation. It requires
// that the mean and standard deviation for each row have already been
// computed and are provided as inputs.
//
// The formula applied is:
//   a^hat_ij = (a_ij - mean_i) / (sd_i + epsilon)
//   y_ij = gamma_j * a^hat_ij + beta_j
//
// Where:
// - A is the input matrix of size M x N (M samples, N features).
// - mean is a pre-computed M x 1 matrix (mean of each row in A).
// - sd is a pre-computed M x 1 matrix (std dev of each row in A).
// - gamma is a learnable 1 x N parameter vector (scaling/gain).
// - beta is a learnable 1 x N parameter vector (shifting/bias).
//
// This shader assumes gamma and beta are packed into a single 1xN texture,
// with beta in the .r channel and gamma in the .g channel.
////////////////////////////////////

uniform sampler2D matrixA; // Texture containing matrix A
uniform sampler2D matrixMean; // Texture containing matrix mean
uniform sampler2D matrixSd; // Texture containing matrix sd
uniform sampler2D matrixBeta; // Texture containing matrix beta
uniform sampler2D matrixGamma; // Texture containing matrix gamma

out vec4 fragColor; // The computed matrix element of Y

void main() {
  const float epsilon = 1e-5; // For numerical stability

  float a = texture(matrixA, texCoord).r;
  float mean = texture(matrixMean, vec2(0.5, texCoord.y)).r;
  float sd = texture(matrixSd, vec2(0.5, texCoord.y)).r;
  float beta = texture(matrixBeta, vec2(texCoord.x, 0.5)).r;
  float gamma = texture(matrixGamma, vec2(texCoord.x, 0.5)).r;

  float a_hat = (a - mean) / (sd + epsilon);
  float y = gamma * a_hat + beta;

  fragColor = vec4(y, 0.0, 0.0, 1.0);
}

