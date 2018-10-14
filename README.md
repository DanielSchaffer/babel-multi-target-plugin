# webpack-babel-multi-target-plugin

This project, inspired by Phil Walton's article
[Deploying es2015 Code in Production Today](https://philipwalton.com/articles/deploying-es2015-code-in-production-today/),
adds tooling to simplify the additional configuration with a
Webpack plugin, `BabelMultiTargetPlugin`.

# Setup and Configuration

[![NPM](https://nodei.co/npm/webpack-babel-multi-target-plugin.png)](https://npmjs.org/package/webpack-babel-multi-target-plugin)

Using the plugin requires making a few small changes to your existing webpack configuration:

* Replace any instances of `babel-loader` with `BabelMultiTargetPlugin.loader()`

* Set `resolve.mainFields` to include `es2015`, which allows webpack to
load the es2015 modules if a package provides them according to the
Angular Package Format. Additional field names may be added to support
other package standards.

* Add an instance of `BabelMultiTargetPlugin` to the webpack
 configuration's `plugins` property

* `BabelMultiTargetPlugin` does not require any configuration - but can
be customized (see below)

* Remove any `.babelrc` - see "Options Reference" below for setting preset options

* TypeScript
  * Loader rules must use `BabelMultiTargetPlugin.loader()` after your compiler loader (remember, loaders are run bottom to top)
  * Set `tsconfig` to `target` es6 or higher

* Vue
  * Replace `'vue-loader'` with `BabelMultiTargetPlugin.loader('vue-loader')`

## Configuration Defaults

`BabelMultiTargetPlugin` does not require any options to be set. The
default behavior is:

* Generate "modern" and "legacy" bundles.

* The "modern" bundle assets will have their filenames appended with
`.modern`, while the "legacy" bundle assets will remain the same. This
enables these assets to be deployed without breaking anything since it
will still have the required polyfills.

* "modern" browsers are the last 2 versions of each browser, excluding
versions that don't support `<script type="module">`

### Options Reference

* **`babel.plugins`** (`string[]`) - a list of Babel plugins to use. `@babel/plugin-syntax-dynamic-import` is included automatically.
* **`babel.presetOptions`** (`BabelPresetOptions`) - options passed to `@babel/preset-env`. See Babel's preset-env [options](https://babeljs.io/docs/en/babel-preset-env#options) documentation for more info.
  * Default: `{ modules: false, useBuiltIns: 'usage' }`
  * **IMPORTANT:** `modules` is forced to `false` to avoid problems with transformed commonjs modules
* **`doNotTarget`** (`RegExp[]`) - an array of `RegExp` patterns for modules which
 will be excluded from targeting (see "How It Works" below)
* **`exclude`** (`RegExp[]`) - an array of `RegExp` patterns for modules which will
 be excluded from transpiling
* **`targets`** (`{ [browserProfile: string]: BabelTargetOptions }`) - a
 map of browser profiles to target definitions. This is used to control
 the transpilation for each browser target. See "Configuration Defaults"
 above for default values.
  * **`targets[browserProfile].key`** (`string`) - Used internally to
  identify the target, and is appended to the filename of an asset if
  `tagAssetsWithKey` is set to `true`. Defaults to `browserProfile` if
  not set.
  * **`targets[browserProfile].tagAssetsWithKey`** (`boolean`) - Determines whether the
  `key` is appended to the filename of the target's assets. Defaults to
  `true` for the "modern" target, and `false` for the "legacy" target.
  Only one target can have this property set to `false`.
  * **`targets[browserProfile].browsers`** Defines the
   [browserslist](https://babeljs.io/docs/en/babel-preset-env#options) used
  by `@babel/preset-env` for this target.
  * **`targets[browserProfile].esModule`** (`boolean`) - Determines whether
  this target can be referenced by a `<script type="module">` tag. Only
  one target may have this property set to `true`.
  * **`targets[browserProfile].noModule`** (`boolean`) - Determines whether
    this target can be referenced by a `<script nomodule>` tag. Only
    one target may have this property set to `true`.


## Configuration Examples

### Basic Usage

```javascript

// webpack.config.js

const BabelMultiTargetPlugin = require('webpack-babel-multi-target-plugin').BabelMultiTargetPlugin;

module.exports = {

    entry: 'src/main.js',

    resolve: {
        mainFields: [
            'es2015',
            'module',
            'main',
        ],
    },

    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    BabelMultiTargetPlugin.loader(),
                ],
            },
        ],
    },

    plugins: [
        new BabelMultiTargetPlugin(),
    ],

};
```

### TypeScript

```javascript

// webpack.config.js

const BabelMultiTargetPlugin = require('webpack-babel-multi-target-plugin').BabelMultiTargetPlugin;

module.exports = {

    entry: 'src/main.ts',

    resolve: {
        mainFields: [
            'es2015',
            'module',
            'main',
        ],
    },

    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    BabelMultiTargetPlugin.loader(),
                ],
            },
            {
                test: /\.ts$/,
                use: [
                    BabelMultiTargetPlugin.loader(),
                    'awesome-typescript-loader'
                ],
                options: {
                    useCache: true,
                    cacheDirectory: 'node_modules/.cache/awesome-typescript-loader',
                },
            },
        ],
    },

    plugins: [
        new BabelMultiTargetPlugin(),
    ],

};
```

### With Options

```javascript

// webpack.config.js

const BabelMultiTargetPlugin = require('webpack-babel-multi-target-plugin').BabelMultiTargetPlugin;

module.exports = {

    entry: 'src/main.js',

    resolve: {
        mainFields: [
            'es2015',
            'module',
            'main',
        ],
    },

    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    BabelMultiTargetPlugin.loader(),
                ],
            },
        ],
    },

    plugins: [
        new BabelMultiTargetPlugin({

            babel: {
                // babel preset-env plugin options go here
            },

            // excludes the untargetable-library module from being targeted
            doNotTarget: [
                /node_modules\/untargetable-library/,
            ],

            // excludes the transpiling-trouble module from being transpiled
            exclude: [
                /node_modules\/transpiling-trouble/
            ],

            // swap which target gets the name appended
            targets: {

                // results in the "modern" bundle being output as main.js
                // the default is main.modern.js
                modern: {
                    tagAssetsWithKey: false,
                },

                // results in the "legacy" bundle being output as main.old-and-broke.js
                // the default is main.js
                legacy: {
                    key: 'old-and-broke',
                    tagAssetsWithKey: true,
                },
            },
        }),
    ],

};
```

### Don't Transpile ES5-only Libraries

Some libraries may cause runtime errors if they are transpiled - often,
they will already have been transpiled by Babel as part of the author's
publishing process. These errors may look like:

> `Cannot assign to read only property 'exports' of object '\#\<Object\>'`

or

> `__webpack_require__(...) is not a function`

These libraries most likely need to be excluded from Babel's
transpilation. While the plugin will automatically attempt to filter out
CommonJs modules, you can also specify libraries to be excluded in the
`BabelMultiTargetPlugin` constructor:

```javascript

new BabelMultiTargetPlugin({
    exclude: [
        /node_modules\/some-es5-library/,
        /node_modules\/another-es5-library/,
    ],
});
```

## Example Projects
Several simple use cases are provided to show how the plugin works.

### Install Example Project Dependencies
```bash
# installs dependencies for all example projects; requires bash
npm run install-examples
```

### Build the Example Projects
```bash
# builds all example projects
npm run examples

# build just the specified example projects
npm run angular-five typescript-plain
```

### Example Project Dev Server
```bash
# builds and serves all example projects
npm start

# builds and serves just the specified example projects
npm start angular-five typescript-plain
```

Examples will be available at `http://HOST:PORT/examples/EXAMPLE_NAME`.

## How It Works

This plugin works by effectively duplicating each entry point, and giving it
a target. Each target corresponds to a browser definition that is passed
to Babel. As the compilation processes each entry point, the target filters
down from the entry point through each of its dependencies. Once the
compilation is complete, any CSS outputs are merged into a single
module so they are not duplicated (since CSS will be the same regardless
of ES supported level). If [HtmlWebpackPlugin](https://github.com/jantimon/html-webpack-plugin)
is being used, the script tags are updated to use the appropriate
`type="module"` and `nomodule` attributes.

## Benefits

* Automatically sets up your index HTML files with both "modern" and
 "legacy" bundles

* Uses ES2015 source when available, and attempts to automatically avoid
re-transpiling ES5/CommonJs code

* Avoid using between 30-70 KB of polyfill code on browsers that don't
need them (depends on project size and features used)

## Caveats
* Increased build time - since the plugin duplicates entry points, everything
has to be done twice. This can be helped with appropriate cache
configurations where they are available (Babel, TypeScript, etc), but
it may make sense to avoid using this plugin during development.

* May not play nice with [hard-source-webpack-plugin](https://github.com/mzgoddard/hard-source-webpack-plugin)

* Code Splitting - Since CommonJs dependencies can be shared between
 "modern" and "legacy" bundles, apps with multiple entries or
 lazy-loaded modules may end up with a large number of "vendor" chunks.

* Angular Apps: if a dependency does not provide ES modules and imports `@angular/core` as
a CommonJs dependency (e.g. `require('@angular/core')`), things will break, particularly
when using lazy routing modules.
