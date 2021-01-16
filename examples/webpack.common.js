const path = require('path')

const webpack = require('webpack')

// const HardSourceWebpackPlugin        = require('hard-source-webpack-plugin')
const HtmlWebpackPlugin              = require('html-webpack-plugin')
// const HtmlWebpackIncludeAssetsPlugin = require('html-webpack-include-assets-plugin')
// const UglifyJsWebpackPlugin          = require('uglifyjs-webpack-plugin')

const BabelMultiTargetPlugin = require('../').BabelMultiTargetPlugin

/**
 *
 * @param {string} workingDir
 * @param {string[]} examples
 * @param {any} options
 * @returns {webpack.Configuration}
 */
module.exports = (workingDir, examples, options = {}) => ({

  output: {
    publicPath: '/',
    sourceMapFilename: '[file].map',
    path: path.resolve(workingDir, '../../out/examples', path.basename(workingDir)),
  },

  context: workingDir,

  devtool: 'source-map',

  resolve: {
    extensions: ['.ts', '.js', '.jsx'],

    // note that es2015 comes first, which allows using esm2015 outputs from Angular Package Format 5 packages
    mainFields: [
      'es2015',
      'esm2015',
      'fesm2015',

      'module',
      'jsnext:main',

      'esm5',
      'fesm5',

      'browser',
      'main',
    ],

    modules: [
      path.resolve(workingDir, 'node_modules'),
      path.resolve(__dirname, '..', 'node_modules'),
    ],
  },

  module: {
    rules: [
      {
        test: /\.html$/,
        loader: 'html-loader',
        enforce: 'post'
      },
      {
        test: /\.(jpe?g|png|gif)/,
        use: 'file-loader',
      },
      {
        test: /\.pug$/,
        use: [
          'raw-loader',
          {
            loader: 'pug-html-loader',
            options: {
              data: {
                exampleName: path.basename(workingDir),
                examples,
              },
            },
          },
        ],
      },
    ],
  },

  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },

  mode: 'development',

  plugins: [

    new webpack.ProgressPlugin(),

    // new HardSourceWebpackPlugin(),
    new HtmlWebpackPlugin({
      cache: false,
      inject: 'body',
      template: options.template || '../index.pug',
    }),

    new BabelMultiTargetPlugin({
      normalizeModuleIds: true,
      babel: {
        presets: options.babelPresets,
      },
      // babel: {
      //   cacheDirectory: false,
      //   presetOptions: {
      //     debug: true,
      //   },
      // },
      // targets: {
      //   modern: true,
      //   legacy: {
      //     additionalModules: [
      //       '../_shared/hello.js',
      //     ],
      //   },
      // },
    }),

    // new HtmlWebpackIncludeAssetsPlugin({
    //   assets: ['./_shared/include.js'],
    //   append: true,
    // }),
  ],

})
