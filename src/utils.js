// generateId :: Integer -> String
function generateId (len) {
  function dec2hex (dec) {
    return ('0' + dec.toString(16)).substr(-2)
  }
  var arr = new Uint8Array((len || 40) / 2)
  window.crypto.getRandomValues(arr)
  return Array.from(arr, dec2hex).join('')
}

module.exports = {
  generateId
}
