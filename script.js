function logInfo(message) {
  const div = document.createElement('div');
  div.innerHTML = message;
  console.log(div.innerText);
}

async function main() {
  const startTime = performance.now();

  const gpu = await Gpu.create();

  const matrixSize = 256;
  const a = new LogicalMatrix(gpu.context, matrixSize, matrixSize, 'random');
  const b = new LogicalMatrix(gpu.context, matrixSize, matrixSize, 'random');
  const c = new LogicalMatrix(gpu.context, matrixSize, matrixSize, 'zero');

  const NUM_ITERATIONS = 3000;
  let mads = 0;
  for (let i = 0; i < NUM_ITERATIONS; ++i) {
    gpu.executeMatrixMultiply(a, b, c);
    mads += a.width * b.height * c.width * c.height;

    if (i % 250 == 0) {
      // Read the pixels which will force the CPU to wait for the GPU to finish.
      gpu.readPixels(c);
      const endTime = performance.now();
      const computationTime = (endTime - startTime);
      const madsPerSecond = mads / (computationTime / 1000);
      logInfo(`<p>Iteration: ${i} </p>` +
        `<p>WebGL Matrix Multiplication (${matrixSize}x${matrixSize})</p>` +
        `<p>Status: Computation complete.</p><p>Time: ${computationTime.toFixed(2)} ms</p> ` +
        `<p>${(madsPerSecond / 1e9).toFixed(3)} Giga MADS/S</p>`);
    }
  }
  const resultValues = gpu.readPixels(c);
  const canvas = float32ToCanvas(resultValues, c.width);
  document.body.appendChild(canvas);
}

function float32ToCanvas(values, width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(values.length / width);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, canvas.height);
  let maxValue = 0;
  let minValue = 0;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value > maxValue) maxValue = value;
    if (value < minValue) minValue = value;

  }

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const pixelIndex = i * 4; // Each pixel has 4 components (R, G, B, A)

    if (value > 0) {
      // Red channel for positive values
      const intensity = value / maxValue;
      imageData.data[pixelIndex + 0] = Math.floor(intensity * 255); // Red
      imageData.data[pixelIndex + 1] = 0; // Green
      imageData.data[pixelIndex + 2] = 0; // Blue
    } else {
      // Blue channel for negative values
      const intensity = value / minValue; // minValue is negative, so this will be positive
      imageData.data[pixelIndex + 0] = 0; // Red
      imageData.data[pixelIndex + 1] = 0; // Green
      imageData.data[pixelIndex + 2] = Math.floor(intensity * 255); // Blue
    }
    imageData.data[pixelIndex + 3] = 255; // Alpha (fully opaque)
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

main();