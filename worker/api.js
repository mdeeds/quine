// @ts-check

export { };

/**
 * @typedef {object} WorkerRequest Defines the structure of messages sent to and from the worker.
 * @property {string} type The command to execute or the type of response.
 * @property {any} [payload] The data associated with the command or response.
 * @property {number?} requestId An optional request Id.
 */

/**
 * @typedef {object} ComponentDescription
 * @property {string} name The name of the node.  Not set for operations
 * @property {string} type Either 'node' or 'operation'.
 * @property {string} detail A detail string describing the component.
 */

/**
 * @typedef {object} MatrixSpec
 * @property {number} width
 * @property {number} height
 * @property {string!} nodeType
 */
