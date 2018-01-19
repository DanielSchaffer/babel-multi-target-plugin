# BabelMultiTargetPlugin

This project, inspired by Phil Walton's article
[Deploying es2015 Code in Production Today](https://philipwalton.com/articles/deploying-es2015-code-in-production-today/),
attempts to add tooling to help with the compilation steps. This is accomplished using
a plugin, `BabelMultiTargetPlugin`.

The plugin works by cloning the original webpack configuration and creating a child
compilation to handle the "legacy" compilation. The plugin replaces the `babel-loader`
options wherever it finds a `babel-loader` usage. When used with `HtmlWebpackPlugin`,
it modifies the tags rendered to change the "modern" `<script>` tags to use
`type="module"`, and adds additional `<script nomodule>` tags for the "legacy"
assets.

# Configuration

`BabelMultiTargetPlugin` requires a few changes to how most people configure webpack.

* Plugin Factory - Many plugins don't behave well after having their instances copied, cloned, or re-used,
so it's easiest to just provide a function which creates the array of plugins you need. `BabelMultiTargetPlugin`
will replace the plugins in the cloned configuration with the output of the factory.

* Set `resolve.mainFields` to include `es2015`, which allows webpack to load the es2015 modules if a
package provides them according to the Angular Package Format. Additional field names may be added to support
other package standards.

* Include `node_modules` in rules using `babel-loader`. While `node_modules` is typically excluded,
it must be included so that packages that are loaded as ES modules can be transpiled. This is made
easiest by using `BabelHelper`'s suite of utility functions (`createBabelRule`, `createBabelJsRule`,
`createBabelTsRule`, and so on).

* No `.babelrc`

## Configuration Examples

### Basic Usage

```javascript

// webpack.config.js

const BabelConfigHelper = require('babel-multi-target-plugin').BabelConfigHelper;
const babelConfigHelper = new BabelConfigHelper();

const pluginFactory = () => [
    // required for tree-shaking
    new UglifyJsWebpackPlugin({
        uglifyOptions: { compress: false },
    }),
];

module.exports = {

    resolve: {
        mainFields: [
            'es2015',
            'module',
            'main',
        ],
    },

    module: {
        rules: [
            babelHelper.createBabelJsRule(),
        ],
    },

    plugins: [
        babelHelper.multiTargetPlugin({
            plugins: pluginFactory,
        }),
    ],

};
```

### Making the Legacy Bundle the Main Bundle
While the plugin is set up to build the "modern" (ESNext) bundle as the main bundle
by default, it may make more sense for some projects use the legacy bundle as the
main bundle. This only requires changing the instantiation of `BabelConfigHelper` slightly:

```javascript

// webpack.config.js

const BabelConfigHelper = require('babel-multi-target-plugin').BabelConfigHelper;
const babelConfigHelper = new BabelConfigHelper({
    browserProfile: 'legacy',
});

};
```

### Don't Transpile ES5-only Libraries

Some libraries may cause runtime errors if they are transpiled - often, they will already
have been transpiled by Babel as part of the author's publishing process. These errors may
look like:

> `Cannot assign to read only property 'exports' of object '\#\<Object\>'`

or

> `__webpack_require__(...) is not a function`

These libraries most likely need to be excluded from Babel's transpilation. You can
specify libraries to be excluded in the `BabelConfigHelper` constructor, and they will
be added to the `exclude` property for any rules generated by the helper instance:

```javascript

// webpack.config.js

const BabelConfigHelper = require('babel-multi-target-plugin').BabelConfigHelper;
const babelConfigHelper = new BabelConfigHelper({
    exclude: [
        /node_modules\/some-es5-library/,
        /node_modules\/another-es5-library/,
    ],
});
```

# Example Projects
Several simple use cases are provided to show how the plugin works.

## Build the Example Projects
```bash
# builds all example projects
npm run examples

# build just the specified example projects
npm run angular-five typescript-plain
```

## Example Project Dev Server
```bash
# builds and serves all example projects
npm start

# builds and serves just the specified example projects
npm start angular-five typescript-plain
```

Examples will be available at `http://HOST:PORT/examples/EXAMPLE_NAME`.

# Caveats
* Does not play nice with [hard-source-webpack-plugin](https://github.com/mzgoddard/hard-source-webpack-plugin)
  * Can be used on main compilation, but not on the child compilation created by `BabelMultiTargetPlugin`

# API Reference

## BabelConfigHelper
Provides the primary API for `babel-multi-target-plugin`, including helpers for configuring webpack
loaders and rules, as well as a shortcut for instantiating the plugin itself.

### ctr(\[options\])
`BabelConfigHelper` may be instantiated with an options object contain any of the following optional
properties:

* `browserProfile`: May be set to `modern` or `legacy`. Defaults to `modern`. This effectively controls
which bundle is treated as the primary bundle. By default, the secondary compilation generated by the
plugin is used to create the legacy bundle, and will be automatically suffixed with the prefix provided to
the plugin (see `multiTargetPlugin()` below).

* `browserProfiles`: An object containing `modern` and `legacy` properties that defines the browser
targets used for each bundle. By default, the following targets are used:

  * `modern`
  ```
      // The last two versions of each browser, excluding versions
      // that don't support <script type="module">.
      'last 2 Chrome versions', 'not Chrome < 60',
      'last 2 Safari versions', 'not Safari < 10.1',
      'last 2 iOS versions', 'not iOS < 10.3',
      'last 2 Firefox versions', 'not Firefox < 54',
      'last 2 Edge versions', 'not Edge < 15'
  ```

  * `legacy`
  ```
      '> 1%',
      'last 2 versions',
      'Firefox ESR'
  ```

Specifying either or both properties will replace these defaults.

* `exclude`: An array of strings or `RegExp` instances that will be used to exclude packages from any
`babel-loader` rule generated by the helper. This is helpful to use for packages that do not provide
an ES module entry, or otherwise don't work after being transpiled. The value of this property will be
appended to default list of excluded packages.

* `babelPlugins`: An array of Babel plugins to be used for any loader or rule generated by the helper.
`@babel/plugin-syntax-dynamic-import` is always including.

* `babelPresetOptions`: An object containing preset options for `@babel/preset-env`, which will be merged
the browser targets as well as the default options:
    ```
    {
        modules: false,
        useBuiltIns: 'usage',
    }
    ```

### createBabelLoader()
Creates a webpack loader object in the `webpack.NewLoader` format.

```
// webpack.config.js
module: {
    rules: [
        {
            test: /my-test/,
            use: [
                babelConfigHelper.createBabelLoader(),
                'some-other-loader',
            ],
        }
    ],
}
```

### createBabelRule(test, \[loaders\])
Creates a webpack `UseRule` with the specified `test` and a preconfigured `babel-loader`.
Automatically adds the `exclude` property. Any additionally specified loaders are appended
after `babel-loader'.

```
// webpack.config.js
module: {
    rules: [
        babelConfigHelper.createBabelRule(/my-test/, ['some-other-loader']),
    ],
}
```

### createBabelJsRule(\[loaders\])
Creates a webpack `UseRule` with the test `/\.js$/` and a preconfigured `babel-loader`.
Automatically adds the `exclude` property. Any additionally specified loaders are appended
after `babel-loader'.

```
// webpack.config.js
module: {
    rules: [
        babelConfigHelper.createBabelJsRule(['some-other-loader']),
    ],
}
```

### createBabelTsRule(\[loaders\])
Creates a webpack `UseRule` with the test `/\.ts$/` and a preconfigured `babel-loader`.
Automatically adds the `exclude` property. Any additionally specified loaders are appended
after `babel-loader'.

```
// webpack.config.js
module: {
    rules: [
        babelConfigHelper.createBabelTsRule(['awesome-typescript-loader']),
    ],
}
```

### createBabelAngularRule(\[loaders\])
Creates a webpack `UseRule` with the test `/(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/` and preconfigured
`babel-loader` and `@ngtools/webpack` loaders. Automatically adds the `exclude` property. Any
additionally specified loaders are appended after `babel-loader'.

```
// webpack.config.js
module: {
    rules: [
        babelConfigHelper.createBabelAngularRule(),
    ],
}
```

### multiTargetPlugin(options)
Creates an instance of `BabelMultiTargetPlugin` which will cause a secondary webpack compilation to be
created for outputting a bundle targeted to the opposite browser profile. In other words, if
`BabelConfigHelper` was instantiated with default settings, or otherwise set to `{ browserProfile: 'modern' }`,
the resulting plugin instance would result in a child compilation for the `legacy` profile.

`options`:
    * `key`: an optional string that is used to identify the secondary bundle. Defaults to the
    name of the browser profile (`legacy` or `modern`). Will suffix the bundle filename in
    the format `{bundle-name}.{key}.js`.
    * `plugins`: A function that returns an array of webpack plugin instances. (see example at top of page)

### createTransformOptions()
Creates an object that can be used as the options passed to `babel-loader`.

### profile(browserProfile)
Creates a new instance of `BabelConfigHelper` using the specified `browserProfile` -
`modern` or `legacy`.