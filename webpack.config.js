var path = require('path')

module.exports = {
  entry: './src/index.js',
  target: 'web',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'akasha-id-wallet.js',
    library: 'AKASHAidWallet',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  node: {
    fs: 'empty'
  }
}
