var webpack = require('webpack');
var path = require('path');

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.join(__dirname, 'dist'),
    filename: "index.js",
    libraryTarget: "umd"
  },
  module: {
    preLoaders: [
      { test: /\.js$/,
        loader: "eslint-loader",
        exclude: /node_modules/
      }
    ],
    loaders: [
      { test: /\.css$/,
        loaders: ["style", "css?modules"]
      },
      { test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel?optional[]=runtime&stage=0"
      }
    ]
  },
  eslint: {
    failOnError: true
  }
}
