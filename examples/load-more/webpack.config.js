var webpack = require('webpack');
var path = require('path');

module.exports = {
  entry: "./src/index.js",
  output: {
    path: __dirname,
    filename: "index.js"
  },
  module: {
    loaders: [
      { test: /\.css$/,
        loaders: ["style", "css?modules"]
      },
      { test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel?optional[]=runtime&stage=0"
      }
    ]
  }
}
