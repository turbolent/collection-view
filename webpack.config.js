const path = require('path')
const MinifyPlugin = require("babel-minify-webpack-plugin");
const webpack = require('webpack');

module.exports = (env) => {
  let plugins = []
  if (env === 'production') {
    plugins = [
      new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify('production')
      }),
      new MinifyPlugin()
    ];
  }



  return {
    entry: './src/index.ts',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
          exclude: /node_modules/
        },
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
    },
    resolve: {
      extensions: [ ".ts", ".js" ]
    },
    output: {
      filename: 'index.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: "umd"
    },
    plugins
  }
};
