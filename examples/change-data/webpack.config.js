var path = require('path');

module.exports = {
  mode: 'development',
  entry: "./src/index.js",
  output: {
    path: __dirname,
    filename: "index.js"
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              modules: true,
            }
          }
        ]
      }
    ]
  }
}
