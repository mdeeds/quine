// @ts-check

export class TextMatrix {

  /**
   * 
   * @param {string!} name
   * @param {import('./worker/api.js').MatrixSpec!} spec 
   */
  constructor(name, spec) {
    this.name = name;
    this.spec = spec;
    this.div = document.createElement('div');
    this.div.style.margin = '3px';
    this.div.style.border = '1px solid black';
    this.div.style.display = 'inline-block'; // Make div only as large as its content
  }

  _numberSpan(value, gradient) {
    const valueSpan = document.createElement('span');
    valueSpan.style.display = 'inline-block';
    const gradSpan = document.createElement('span');
    gradSpan.style.display = 'inline-block';
    gradSpan.classList.add('grad');
    valueSpan.innerText = value.toFixed(2);
    gradSpan.innerText = `${gradient >= 0 ? '+' : ''}${gradient.toFixed(2)}`;

    const result = document.createElement('span');
    result.appendChild(valueSpan);
    result.appendChild(gradSpan);
    return result;
  }

  // Updates the displayed matrix in this.div with values from this.matrix.
  /**
   * 
   * @param {Float32Array} values 
   * @param {Float32Array} gradients 
   */
  update(values, gradients) {
    const { width, height } = this.spec;

    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.fontFamily = 'monospace';

    if (values.length != this.spec.width * this.spec.height) {
      throw new Error(`Size mismatch: ${values.length} != ${this.spec.width * this.spec.height}`);
    }

    for (let r = 0; r < height; r++) {
      const tr = table.insertRow();
      for (let c = 0; c < width; c++) {
        const td = tr.insertCell();
        const i = r * width + c;
        const value = values[i];
        const gradient = gradients[i];
        td.style.border = '1px solid #ccc';
        td.style.padding = '4px 8px';
        td.style.textAlign = 'right';
        td.appendChild(this._numberSpan(value, gradient));
      }
    }

    // Clear previous content before appending the new table.
    this.div.innerHTML = `<span>${this.name}</span>:<span>${this.spec.nodeType}</span}`;
    this.div.appendChild(table);
  }
}