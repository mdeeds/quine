// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  const multiplyButton = document.getElementById('multiply-button');
  const matrixW_textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('matrix-w'));
  const matrixX_textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('matrix-x'));
  const matrixB_textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('matrix-b'));

  const matrixY_div = document.getElementById('matrix-y');

  if (!multiplyButton || !matrixW_textarea || !matrixX_textarea || !matrixB_textarea ||
    !matrixY_div) {
    console.error('Required HTML elements not found.');
    return;
  }

  // Set default values for textareas for a non-square multiplication example.
  matrixW_textarea.value = '[[1, 0],\n [0, 1]]'; // 2x2 identity matrix
  matrixX_textarea.value = '[[1, 0],\n [0, 1]]'; // 2x2 identity matrix
  matrixB_textarea.value = '[[0, 0]]'; // no bias

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
      matrixY_div.textContent = 'Processing...';

      const matrixW_info = parseMatrix(matrixW_textarea.value);
      const matrixX_info = parseMatrix(matrixX_textarea.value);
      const matrixB_info = parseMatrix(matrixB_textarea.value);


      // For y = xw + b, x's width must match w's height.
      if (matrixX_info.width !== matrixW_info.height) {
        throw new Error(`Matrix dimension mismatch: X's width (${matrixX_info.width}) must equal W's height (${matrixW_info.height}).`);
      }

      gpu = await Gpu.create();
      const w = new LogicalMatrix(
        gpu.context, matrixW_info.width, matrixW_info.height, 'data', matrixW_info.data);
      const x = new LogicalMatrix(
        gpu.context, matrixX_info.width, matrixX_info.height, 'data', matrixX_info.data);
      const b = new LogicalMatrix(
        gpu.context, matrixB_info.width, matrixB_info.height, 'data', matrixB_info.data);

      const y = new LogicalMatrix(gpu.context, w.width, x.height, 'zero');

      gpu.executeMatrixMultiplyAddBias(x, w, b, y);
      const resultData = gpu.readPixels(y);

      matrixY_div.textContent = formatMatrix(resultData, y.width, y.height);

      // Clean up GPU resources
      gpu.deleteTexture(x.texture);
      gpu.deleteTexture(b.texture);
      gpu.deleteTexture(w.texture);
      gpu.deleteTexture(y.texture);

    } catch (error) {
      throw error;
    } finally {
      if (gpu) {
        gpu.destroy();
      }
    }
  });
});