// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  const matrixW_textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('matrix-w'));
  const matrixX_textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('matrix-x'));
  const matrixY_textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('matrix-y'));
  const forwardButton = document.getElementById('forward-button');
  const backwardButton = document.getElementById('backward-button');
  const updateButton = document.getElementById('update-button');

  if (!forwardButton || !backwardButton || !updateButton ||
    !matrixW_textarea || !matrixX_textarea || !matrixY_textarea) {
    console.error('Required HTML elements not found.');
    return;
  }

  // Set default values for textareas for a non-square multiplication example.
  matrixW_textarea.value = '"uninitialized"';
  matrixX_textarea.value = '[[1,2,3],[4,5,6]]';
  matrixY_textarea.value = '[[1,2,3],[4,5,6]]';

  /**
   * Parses a matrix string (e.g., "[[1, 2], [3, 4]]") into its dimensions and data.
   * @param {string} matrixStr
   * @returns {{data: Float32Array?, width: number, height: number} | null}
   */
  function parseMatrix(matrixStr) {
    try {
      // Use JSON.parse for robust parsing of array syntax.
      const rows = JSON.parse(matrixStr);
      if (!Array.isArray(rows)) {
        return null;
      }
      if (rows.length === 0 || !Array.isArray(rows[0])) {
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

  async function updateText(gpu, logicalMatrix, textArea) {
    const resultData = gpu.readPixels(logicalMatrix);
    const resultStr = formatMatrix(resultData, logicalMatrix.width, logicalMatrix.height);
    textArea.value = resultStr;
  }

  /**
   * 
   * @param {Gpu!} gpu 
   * @param {{data: Float32Array?, width: number, height: number}} matrixInfo 
   * @returns {LogicalMatrix!}
   */
  function createFromDataOrRandom(gpu, matrixInfo, matrixTextarea) {
    if (matrixInfo.data) {
      return new LogicalMatrix(
        gpu.context, matrixInfo.width, matrixInfo.height, 'data', matrixInfo.data);
    } else {
      const result = new LogicalMatrix(gpu.context, matrixInfo.width, matrixInfo.height, 'random');
      updateText(gpu, result, matrixTextarea);
      return result;
    }
  }

  function createZeroLike(context, otherLogicalMatrix) {
    return new LogicalMatrix(
      context, otherLogicalMatrix.width, otherLogicalMatrix.height, 'zero');

  }

  forwardButton.addEventListener('click', async () => {
    let matrixW_info = parseMatrix(matrixW_textarea.value);
    const matrixX_info = parseMatrix(matrixX_textarea.value);
    if (!matrixX_info) {
      throw new Error("Invalid matrix X");
    }
    const matrixY_info = parseMatrix(matrixY_textarea.value);
    if (!matrixY_info) {
      throw new Error("Invalid matrix X");
    }
    if (!matrixW_info) {
      matrixW_info = { data: null, width: matrixX_info.height, height: matrixY_info.height };
    }

    const gpu = await Gpu.create();

    const w = createFromDataOrRandom(gpu, matrixW_info, matrixW_textarea);
    const x = createFromDataOrRandom(gpu, matrixX_info, matrixX_textarea);
    const y = createFromDataOrRandom(gpu, matrixY_info, matrixY_textarea);

    const dw = createZeroLike(gpu.context, w);
    const dx = createZeroLike(gpu.context, x);
    const dy = createZeroLike(gpu.context, y);

    const mmo = new MatrixMultiplyOperation(gpu, w, dw, x, dx, y, dy);
    mmo.forward();

    const resultData = gpu.readPixels(y);
    const resultStr = formatMatrix(resultData, y.width, y.height);
    console.log(resultStr);
  });

  function logMatrix(gpu, matrix, name) {
    const resultData = gpu.readPixels(matrix);
    const resultStr = formatMatrix(resultData, matrix.width, matrix.height);
    console.log(`${name}: ` + resultStr);

  }

  backwardButton.addEventListener('click', async () => {
    const matrixX_info = parseMatrix(matrixX_textarea.value);
    if (!matrixX_info) {
      throw new Error("Invalid matrix X");
    }
    const matrixY_info = parseMatrix(matrixY_textarea.value);
    if (!matrixY_info) {
      throw new Error("Invalid matrix Y");
    }
    let matrixW_info = parseMatrix(matrixW_textarea.value);
    if (!matrixW_info) {
      matrixW_info = { data: null, width: matrixX_info.height, height: matrixY_info.height };
    }

    const gpu = await Gpu.create();

    const w = createFromDataOrRandom(gpu, matrixW_info, matrixW_textarea);
    const x = createFromDataOrRandom(gpu, matrixX_info, matrixX_textarea);
    const y_expected = createFromDataOrRandom(gpu, matrixY_info, matrixY_textarea);

    const dw = createZeroLike(gpu.context, w);
    const dx = createZeroLike(gpu.context, x);
    const dy = createZeroLike(gpu.context, y_expected);
    const y_actual = createZeroLike(gpu.context, y_expected);

    const mmo = new MatrixMultiplyOperation(gpu, w, dw, x, dx, y_actual, dy);
    mmo.forward();
    logMatrix(gpu, y_actual, "actual");
    logMatrix(gpu, y_expected, "expected");

    gpu.executeLoss(y_expected, y_actual, dy);
    logMatrix(gpu, dy, "dY");

    mmo.backward();
    logMatrix(gpu, dw, "dW")
  });

  updateButton.addEventListener('click', async () => {
    const matrixX_info = parseMatrix(matrixX_textarea.value);
    if (!matrixX_info) {
      throw new Error("Invalid matrix X");
    }
    const matrixY_info = parseMatrix(matrixY_textarea.value);
    if (!matrixY_info) {
      throw new Error("Invalid matrix Y");
    }
    let matrixW_info = parseMatrix(matrixW_textarea.value);
    if (!matrixW_info) {
      matrixW_info = { data: null, width: matrixX_info.height, height: matrixY_info.height };
    }

    const gpu = await Gpu.create();

    const w = createFromDataOrRandom(gpu, matrixW_info, matrixW_textarea);
    const x = createFromDataOrRandom(gpu, matrixX_info, matrixX_textarea);
    const y_expected = createFromDataOrRandom(gpu, matrixY_info, matrixY_textarea);

    const dw = createZeroLike(gpu.context, w);
    const dx = createZeroLike(gpu.context, x);
    const dy = createZeroLike(gpu.context, y_expected);
    const y_actual = createZeroLike(gpu.context, y_expected);

    const mmo = new MatrixMultiplyOperation(gpu, w, dw, x, dx, y_actual, dy);
    mmo.forward();
    logMatrix(gpu, y_actual, "actual");
    logMatrix(gpu, y_expected, "expected");

    gpu.executeLoss(y_expected, y_actual, dy);
    logMatrix(gpu, dy, "dY");

    mmo.backward();
    logMatrix(gpu, dw, "dW")

    gpu.executeMatrixAtanUpdate(dw, 0.05, w);
    logMatrix(gpu, w, "w")
    updateText(gpu, w, matrixW_textarea);
  });
});