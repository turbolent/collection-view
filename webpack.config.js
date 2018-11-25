const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
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
    optimization: {
      minimizer: [
        new UglifyJsPlugin({
          parallel: true
        })
      ]
    }
}
