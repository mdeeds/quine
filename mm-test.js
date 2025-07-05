// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  const multiplyButton = document.getElementById('multiply-button');
  const matrixA_textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('matrix-a'));
  const matrixB_textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('matrix-b'));
  const matrixC_div = document.getElementById('matrix-c');

  if (!multiplyButton || !matrixA_textarea || !matrixB_textarea || !matrixC_div) {
    console.error('Required HTML elements not found.');
    return;
  }

  // Set default values for textareas for a non-square multiplication example.
  matrixA_textarea.value = '[[1, 0],\n [0, 1]]'; // 2x2 identity matrix
  matrixB_textarea.value = '[[1, 0],\n [0, 1]]'; // 2x2 identity matrix

  /**
   * Parses a matrix string (e.g., "[[1, 2], [3, 4]]") into its dimensions and data.
   * @param {string} matrixStr
   * @returns {{data: Float32Array, width: number, height: number}}
   */
  function parseMatrix(matrixStr) {
    try {
      // Use JSON.parse for robust parsing of array syntax.
      const rows = JSON.parse(matrixStr);
      if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(rows[0])) {
        throw new Error('Invalid matrix format. Expected an array of arrays.');
      }

      const height = rows.length;
      const width = rows[0].length;
      const data = new Float32Array(width * height);

      let i = 0;
      for (let r = 0; r < height; r++) {
        if (rows[r].length !== width) {
          throw new Error('All rows in the matrix must have the same length.');
        }
        for (let c = 0; c < width; c++) {
          const value = Number(rows[r][c]);
          if (isNaN(value)) {
            throw new Error(`Invalid number found at row ${r}, col ${c}.`);
          }
          data[i] = value;
          ++i;
        }
      }
      return { data, width, height };
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error('Failed to parse matrix. Please ensure it is valid JSON, e.g., [[1, 2], [3, 4]].');
      }
      // Re-throw other errors (like my custom ones)
      throw e;
    }
  }

  /**
   * Formats a matrix (flat array) into a readable string.
   * @param {Float32Array} data
   * @param {number} width
   * @param {number} height
   * @returns {string}
   */
  function formatMatrix(data, width, height) {
    let i = 0;
    const result = [];
    for (let r = 0; r < height; r++) {
      const resultRow = [];
      for (let c = 0; c < width; c++) {
        resultRow.push(data[i]);
        ++i;
      }
      result.push(resultRow);
    }
    return JSON.stringify(result, null, 2);
  }

  multiplyButton.addEventListener('click', async () => {
    let gpu;
    try {
      matrixC_div.textContent = 'Processing...';

      const matrixA_info = parseMatrix(matrixA_textarea.value);
      const matrixB_info = parseMatrix(matrixB_textarea.value);

      if (matrixA_info.width !== matrixB_info.height) {
        throw new Error(`Matrix dimension mismatch: A's width (${matrixA_info.width}) must equal B's height (${matrixB_info.height}).`);
      }

      gpu = await Gpu.create();
      const a = new LogicalMatrix(
        gpu.context, matrixA_info.width, matrixA_info.height, 'data', matrixA_info.data);
      const b = new LogicalMatrix(
        gpu.context, matrixB_info.width, matrixB_info.height, 'data', matrixB_info.data);
      const c = new LogicalMatrix(gpu.context, b.width, a.height, 'zero');

      gpu.executeMatrixMultiply(a, b, c);
      const resultData = gpu.readPixels(c);

      matrixC_div.textContent = formatMatrix(resultData, c.width, c.height);

      // Clean up GPU resources
      gpu.deleteTexture(a.texture);
      gpu.deleteTexture(b.texture);
      gpu.deleteTexture(c.texture);

    } catch (error) {
      console.error('An error occurred:', error);
      matrixC_div.textContent = `Error: ${error.message}`;
    } finally {
      if (gpu) {
        gpu.destroy();
      }
    }
  });
});