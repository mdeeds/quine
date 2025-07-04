// @ts-check

/**
 * Finds the frequency of adjacent pairs in a sequence of numbers.
 * @param {number[]} ids - The sequence of token IDs.
 * @returns {Map<string, number>} A map from a pair string (e.g., "97,98") to its frequency.
 */
function getStats(ids) {
  const counts = new Map();
  for (let i = 0; i < ids.length - 1; i++) {
    const pair = `${ids[i]},${ids[i + 1]}`;
    counts.set(pair, (counts.get(pair) || 0) + 1);
  }
  return counts;
}

/**
 * Merges all occurrences of a specific pair in a sequence into a new token.
 * @param {number[]} ids - The sequence of token IDs.
 * @param {number[]} pair - The pair to merge, e.g., [97, 98].
 * @param {number} idx - The new token ID to replace the pair with.
 * @returns {number[]} The new sequence of token IDs after merging.
 */
function merge(ids, pair, idx) {
  const newIds = [];
  let i = 0;
  while (i < ids.length) {
    if (i < ids.length - 1 && ids[i] === pair[0] && ids[i + 1] === pair[1]) {
      newIds.push(idx);
      i += 2;
    } else {
      newIds.push(ids[i]);
      i++;
    }
  }
  return newIds;
}

/**
 * A simple Byte-Pair Encoding tokenizer.
 */
class BPETokenizer {
  constructor() {
    /** @type {Map<string, number>} */
    this.merges = new Map(); // (p1, p2) -> new_id
    /** @type {Map<number, string>} */
    this.vocab = new Map();  // id -> string
  }

  /**
   * Trains the tokenizer on a given text.
   * @param {string} text - The text to train on.
   * @param {number} vocab_size - The desired final vocabulary size.
   */
  train(text, vocab_size) {
    // 1. Initial vocabulary and tokenization (UTF-16 code units)
    let ids = Array.from(text, c => c.charCodeAt(0));

    // Build initial vocab from single characters (0-255 for simplicity)
    for (let i = 0; i < 256; i++) {
      this.vocab.set(i, String.fromCharCode(i));
    }

    // 2. Iteratively merge the most frequent pairs
    const num_merges = vocab_size - 256;
    for (let i = 0; i < num_merges; i++) {
      const stats = getStats(ids);
      if (stats.size === 0) break;

      // Find the most frequent pair
      const topPairEntry = [...stats.entries()].reduce((a, b) => a[1] > b[1] ? a : b);

      // If the most frequent pair only occurs once, there's no point in merging.
      if (topPairEntry[1] <= 1) {
        break;
      }
      const topPairStr = topPairEntry[0];
      const pair = topPairStr.split(',').map(Number);
      const idx = 256 + i;


      // Merge the pair in the sequence of IDs
      ids = merge(ids, pair, idx);

      // Store the merge rule and the new vocabulary entry
      this.merges.set(topPairStr, idx);
      if (!pair[0] || !pair[1] ||
        !this.vocab.has(pair[0]) || !this.vocab.has(pair[1])) {
        throw "Missing pair in vocab!";
      }
      this.vocab.set(idx, this.vocab.get(pair[0]) + this.vocab.get(pair[1]));
    }
  }

  /**
   * Encodes a string into a sequence of token IDs.
   * @param {string} text - The input string.
   * @returns {number[]} The encoded token IDs.
   */
  encode(text) {
    let ids = Array.from(text, c => c.charCodeAt(0));

    // Apply learned merges in the order they were learned
    for (const [pairStr, idx] of this.merges.entries()) {
      const pair = pairStr.split(',').map(Number);
      ids = merge(ids, pair, idx);
    }

    return ids;
  }

  /**
   * Decodes a sequence of token IDs back into a string.
   * @param {number[]} ids - The sequence of token IDs to decode.
   * @returns {string} The decoded string.
   */
  decode(ids) {
    const text = ids.map(id => this.vocab.get(id)).join('');
    return text;
  }
}

/**
 * Displays the tokenization results on the page.
 * @param {BPETokenizer} tokenizer 
 * @param {number[]} encodedIds 
 */
function displayResults(tokenizer, encodedIds, original) {
  const outputDiv = document.getElementById('output-container');
  if (!outputDiv) return;

  // Clear previous results before adding new ones
  outputDiv.innerHTML = '';

  const decodedText = tokenizer.decode(encodedIds);

  // --- Build the UI programmatically to ensure proper escaping and structure ---

  // Main Title
  const title = document.createElement('h3');
  title.textContent = 'Tokenization Results';
  outputDiv.appendChild(title);

  // Original stats
  const originalP = document.createElement('p');
  originalP.innerHTML = `<strong>Input size:</strong> ${original.length}`;
  outputDiv.appendChild(originalP);

  // Encoded IDs
  const encodedP = document.createElement('p');
  encodedP.innerHTML = `<strong>Encoded size:</strong> ${encodedIds.length}`;
  outputDiv.appendChild(encodedP);

  // Vocab size
  const vocabP = document.createElement('p');
  vocabP.innerHTML = `<strong>Vocabulary size:</strong> ${tokenizer.vocab.size}`;
  outputDiv.appendChild(vocabP);

  // Decoded Text Section
  const decodedP = document.createElement('p');
  decodedP.innerHTML = '<strong>Decoded Text:</strong>';
  outputDiv.appendChild(decodedP);

  const decodedContentDiv = document.createElement('div');
  decodedContentDiv.textContent = decodedText; // Using textContent is safe and avoids XSS
  // Add some styling to make the block visible and readable
  Object.assign(decodedContentDiv.style, {
    padding: '10px',
    border: '1px solid #dddfe2',
    borderRadius: '6px',
    backgroundColor: '#f9f9f9',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    marginTop: '4px'
  });
  outputDiv.appendChild(decodedContentDiv);

  // Vocabulary Table Section
  const vocabTitle = document.createElement('h4');
  vocabTitle.textContent = 'Learned Vocabulary (Merges)';
  outputDiv.appendChild(vocabTitle);

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Token ID</th><th>Merged String</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const [id, str] of tokenizer.vocab.entries()) {
    if (id >= 256) { // Only show new merged tokens
      const tr = tbody.insertRow();
      tr.insertCell().textContent = id.toString();
      tr.insertCell().textContent = `'${str}'`; // textContent handles any special characters
    }
  }
  table.appendChild(tbody);
  outputDiv.appendChild(table);
}

/**
 * Trains a tokenizer, encodes the text, and displays the results.
 * @param {string} text The input text to process.
 */
function processAndDisplayTokenization(text) {
  // For this demo, we train a new tokenizer on the input text.
  // A real application would load a pre-trained tokenizer.
  const tokenizer = new BPETokenizer();
  const vocab_size = 4096;
  tokenizer.train(text, vocab_size);

  const encoded = tokenizer.encode(text);
  displayResults(tokenizer, encoded, text);

  // Write the learned vocabulary to JSON and display it
  const vocabJson = JSON.stringify(Object.fromEntries(tokenizer.vocab), null, 2);
  displayVocabJson(vocabJson);
}

// --- UI Logic ---

/**
 * Displays the learned vocabulary JSON on the page.
 * @param {string} vocabJson - The JSON string of the vocabulary.
 */
function displayVocabJson(vocabJson) {
  const outputDiv = document.getElementById('vocabulary-json');
  if (!outputDiv) return;
  outputDiv.textContent = vocabJson;
  Object.assign(outputDiv.style, {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  });

}

document.addEventListener('DOMContentLoaded', () => {
  const tokenizeButton = document.getElementById('tokenize-button');
  const textInput = document.getElementById('text-input');

  tokenizeButton?.addEventListener('click', () => {
    const text = /** @type {HTMLTextAreaElement} */ (textInput)?.value;
    if (!text) {
      alert("Please enter some text to tokenize.");
      return;
    }

    processAndDisplayTokenization(text);
  });

  const copyJsonButton = document.getElementById('copy-json-button');
  copyJsonButton?.addEventListener('click', async () => {
    const vocabJsonElement = document.getElementById('vocabulary-json');
    if (vocabJsonElement && navigator.clipboard) {
      await navigator.clipboard.writeText(vocabJsonElement.textContent || '');
      alert('Vocabulary JSON copied to clipboard.');
    } else {
      alert('Clipboard API not available or vocabulary JSON element not found. Make sure you are on a secure origin (HTTPS) or localhost.');
    }
  });

  const tokenizeProjectButton = document.getElementById('tokenize-project-button');
  tokenizeProjectButton?.addEventListener('click', async () => {
    const jsFiles = [
      'bpe.js',
      'context.js',
      'gpu.js',
      'matrix.js',
      'matrix-multiply.js',
      'script.js',
      'mm-fragment.glsl',
      'index.html',
      'token.html',
      'vocabulary.json',
    ];

    let allJsContent = '';
    for (const file of jsFiles) {
      const response = await fetch(file);
      const content = await response.text();
      allJsContent += content;
    }

    // Replace all \r\n with \n
    allJsContent = allJsContent.replace(/\r\n/g, '\n') + '\n';
    // Replace all \r with \n
    allJsContent = allJsContent.replace(/\r/g, '\n') + '\n';
    processAndDisplayTokenization(allJsContent);
  });

});
