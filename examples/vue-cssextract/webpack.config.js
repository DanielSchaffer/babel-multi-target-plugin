const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const VueLoaderPlugin = require('vue-loader/lib/plugin')

const BabelMultiTargetPlugin = require('../../').BabelMultiTargetPlugin

module.exports = {
  entry: {
    main: './src/main.js',
  },

  plugins: [
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin(),
  ],

  module: {
    rules: [{
      test: /\.js$/,
      use: BabelMultiTargetPlugin.loader(),
    }, {
      test: /\.vue$/,
      use: BabelMultiTargetPlugin.loader('vue-loader'),
    },
    {
      test: /\.css$/,
      use: [
        {
          loader: MiniCssExtractPlugin.loader,
          options: {
            esModule: false,
          },
        },
        'css-loader',
      ],
    }],
  },
}
