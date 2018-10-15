const VueLoaderPlugin = require('vue-loader/lib/plugin');
const BabelMultiTargetPlugin = require('../../').BabelMultiTargetPlugin;

module.exports = {
    entry: {
        main: './src/main.js',
    },

    plugins: [
        new VueLoaderPlugin(),
    ],

    module: {
        rules: [{
                test: /\.js$/,
                use: BabelMultiTargetPlugin.loader()
            }, {
                test: /\.vue$/,
                use: [
                    BabelMultiTargetPlugin.loader('vue-loader'),
                ]
            },
            {
                test: /\.css$/,
                use: [
                    'vue-style-loader',
                    'css-loader'
                ]
            }
        ],
    },

    node: {
      // prevent webpack from injecting useless setImmediate polyfill because Vue
      // source contains it (although only uses it if it's native).
      setImmediate: false,
      // prevent webpack from injecting mocks to Node native modules
      // that does not make sense for the client
      dgram: 'empty',
      fs: 'empty',
      net: 'empty',
      tls: 'empty',
      child_process: 'empty'
    }
}
