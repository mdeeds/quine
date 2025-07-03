
// @ts-check
class MatrixMultiply {
  /**
   * 
   * @param {LogicalMatrix!} a 
   * @param {LogicalMatrix!} b 
   */
  constructor(a, b) {
    this.a = a;
    this.b = b;

    if (a.width != b.height) {
      throw new Error(
        `Matrix dimensions mismatch: A.width (${a.width}) must equal ` +
        `B.height (${b.height}) for multiplication.`);
    }
  }

  compile() {

  }

}