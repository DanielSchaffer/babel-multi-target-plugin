const VueLoaderPlugin = require('vue-loader/lib/plugin')

const BabelMultiTargetPlugin = require('../../').BabelMultiTargetPlugin

module.exports = {
  entry: {
    main: './src/main.js',
  },

  plugins: [
    new VueLoaderPlugin(),
  ],

  resolve: {
    alias: {
      moment: 'moment/src/moment',
    },
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        use: BabelMultiTargetPlugin.loader(),
      },
      {
        test: /\.vue$/,
        use: BabelMultiTargetPlugin.loader('vue-loader'),
      },
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader',
        ],
      },
    ],
  },
}
