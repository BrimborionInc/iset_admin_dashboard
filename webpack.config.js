const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  module: {
    rules: [
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name][ext]'
        }
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name][ext]'
        }
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              url: {
                filter: (url) => {
                  return !url.startsWith('/assets/');
                }
              }
            }
          },
          {
            loader: 'string-replace-loader',
            options: {
              search: '/assets/',
              replace: '/assets/',  // Ensure paths match React's public folder
              flags: 'g'
            }
          }
        ]
      }
    ]
  },
  resolve: {
    alias: {
      '/assets': path.resolve(__dirname, 'public/assets')
    },
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
    fallback: {
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "util": require.resolve("util/"),
      "zlib": require.resolve("browserify-zlib"),
      "stream": require.resolve("stream-browserify"),
      "url": require.resolve("url/"),
      "crypto": require.resolve("crypto-browserify"),
      "assert": require.resolve("assert/")
    }
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'node_modules/govuk-frontend/govuk/assets/fonts'), to: path.resolve(__dirname, 'public/assets/fonts') },
        { from: path.resolve(__dirname, 'node_modules/govuk-frontend/govuk/assets/images'), to: path.resolve(__dirname, 'public/assets/images') }
      ]
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ]
};