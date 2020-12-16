import { BabelPresetOptions } from 'babel-loader'

import { StandardTargetOptionsMap } from './babel.target.options'

// Recommended to specify used minor core-js version, like corejs: '3.6', instead of corejs: 3
const DEFAULT_COREJS_VERSION = 3.6

export const DEFAULT_BABEL_PRESET_OPTIONS: BabelPresetOptions = {
  modules: false,
  useBuiltIns: 'usage',
  corejs: DEFAULT_COREJS_VERSION,
}

export const DEFAULT_BABEL_PLUGINS: string[] = [
  '@babel/plugin-syntax-dynamic-import',
  '@babel/plugin-transform-runtime',
]

export const DEFAULT_MODERN_BROWSERS = [
  // The last two versions of each browser, excluding versions
  // that don't support <script type="module">.
  'browserslist config and supports es6-module',
]

export const DEFAULT_LEGACY_BROWSERS = [
  'browserslist config and not supports es6-module',
]

export const DEFAULT_BROWSERS: { [profile: string]: string[] } = {
  modern: DEFAULT_MODERN_BROWSERS,
  legacy: DEFAULT_LEGACY_BROWSERS,
}

export const DEFAULT_TARGET_INFO: StandardTargetOptionsMap = {
  modern: {
    tagAssetsWithKey: true,
    browsers: DEFAULT_MODERN_BROWSERS,
    esModule: true,
    noModule: false,
  },
  legacy: {
    tagAssetsWithKey: false,
    browsers: DEFAULT_LEGACY_BROWSERS,
    esModule: false,
    noModule: true,
  },
}
