/**
   * Generate an AES key based on the cipher mode and keysize
   * @param {boolean} [extractable] - Specify if the generated key is extractable
   * @param {string} [mode] - The aes mode of the generated key
   * @param {Number} [keySize] - Key size
   * @returns {Promise<CryptoKey>} - The generated AES key.
   */
const genAESKey = (extractable, mode, keySize) => {
  return window.crypto.subtle.generateKey({
    name: mode || 'AES-GCM',
    length: keySize || 128
  }, extractable || true, ['decrypt', 'encrypt'])
}

/**
    * Import a raw|jwk as a CryptoKey
    *
    * @param {arrayBuffer|Object} key - The key
    * @param {string} [type] - The type of the key to import ('raw', 'jwk')
    * @param {string} [mode] - The mode of the key to import (default 'AES-GCM')
    * @returns {Promise<arrayBuffer>} - The cryptoKey
    */
const importKey = (key, type = 'raw', mode = 'AES-GCM') => {
  const parsedKey = Buffer.from(key, 'base64')
  return window.crypto.subtle.importKey(type, parsedKey, { name: mode }
    , true, ['encrypt', 'decrypt'])
}

/**
  * Export a CryptoKey into a raw|jwk key
  *
  * @param {CryptoKey} key - The CryptoKey
  * @param {string} [type] - The type of the exported key
  * @returns {Promise<arrayBuffer>} - The raw key or the key as a jwk format
  */
const exportKey = async (key, type = 'raw') => {
  const exportedKey = await window.crypto.subtle.exportKey(type, key)
  if (type === 'raw') return new Uint8Array(exportedKey)
  return exportedKey
}

/**
 * Decrypt buffer
 * @param {ArrayBuffer} key - The AES CryptoKey
 * @param {ArrayBuffer} data - Data to decrypt
 * @param {Object} cipherContext - The AES cipher parameters
 * @returns {Promise<ArrayBuffer>} - The decrypted buffer
 */
const decryptBuffer = async (key, data, cipherContext) => {
  // TODO: test input params
  try {
    const decrypted = await window.crypto.subtle.decrypt(cipherContext, key, data)
    return new Uint8Array(decrypted)
  } catch (e) {
    if (e.message === 'Unsupported state or unable to authenticate data') {
      throw new Error('Unable to decrypt data')
    }
  }
}

/**
   * Encrypt buffer
   *
   * @param {ArrayBuffer} key - The AES CryptoKey
   * @param {ArrayBuffer} data - Data to encrypt
   * @param {Object} cipherContext - The AES cipher parameters
   * @returns {ArrayBuffer} - The encrypted buffer
   */
const encryptBuffer = async (key, data, cipherContext) => {
  const encrypted = await window.crypto.subtle.encrypt(cipherContext, key, data)
  return new Uint8Array(encrypted)
}

const checkCryptokey = (key) => {
  if (!key.type || key.type !== 'secret') {
    throw new Error('Invalid key type')
  }
}

const genRandomBuffer = (len = 16) => {
  const values = window.crypto.getRandomValues(new Uint8Array(len))
  return Buffer.from(values)
}

/**
 * Encrypt data
 *
 * @param {CryptoKey} key - The AES CryptoKey
 * @param {string | Object} - The data to encrypt
 * @param {string} [format] - The ciphertext and iv encoding format
 * @returns {Object} - The stringified ciphertext object (ciphertext and iv)
 */
const encrypt = async (key, data, format = 'hex') => {
  checkCryptokey(key)
  const context = {
    iv: genRandomBuffer(key.algorithm.name === 'AES-GCM' ? 12 : 16),
    plaintext: Buffer.from(JSON.stringify(data))
  }

  // Prepare cipher context, depends on cipher mode
  const cipherContext = {
    name: key.algorithm.name,
    iv: context.iv
  }

  const encrypted = await encryptBuffer(key, context.plaintext, cipherContext)
  return {
    ciphertext: Buffer.from(encrypted).toString(format),
    iv: Buffer.from(context.iv).toString(format)
  }
}

/**
   * Decrypt data
   *
   * @param {CryptoKey} key - The AES CryptoKey
   * @param {string | Object} - The data to encrypt
   * @param {string} [format] - The ciphertext and iv encoding format
   */
const decrypt = async (key, ciphertext, format = 'hex') => {
  checkCryptokey(key)

  const context = {
    ciphertext: ciphertext.hasOwnProperty('ciphertext') ? Buffer.from(ciphertext.ciphertext, (format)) : '',
    // IV is 128 bits long === 16 bytes
    iv: ciphertext.hasOwnProperty('iv') ? Buffer.from(ciphertext.iv, (format)) : ''
  }

  // Prepare cipher context, depends on cipher mode
  const cipherContext = {
    name: key.algorithm.name,
    iv: context.iv
  }
  try {
    const decrypted = await decryptBuffer(key, context.ciphertext, cipherContext)
    return JSON.parse(Buffer.from(decrypted).toString())
  } catch (error) {
    throw new Error('Unable to decrypt data')
  }
}

module.exports = {
  genAESKey,
  importKey,
  exportKey,
  encrypt,
  decrypt
}
