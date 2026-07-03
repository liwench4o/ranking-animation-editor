import path from 'node:path';
import { merge } from 'webpack-merge';
import common, { createCssLoaders, paths } from './webpack.common.js';

const isDevServer = process.argv.includes('serve') || process.env.WEBPACK_SERVE === 'true';

export default merge(common, {
  mode: 'development',
  devtool: 'eval-cheap-module-source-map',
  cache: {
    type: 'filesystem',
    name: isDevServer ? 'foreshadowing-dev-server' : 'foreshadowing-dev-build',
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: createCssLoaders('style-loader'),
      },
    ],
  },
  devServer: {
    static: {
      directory: path.resolve(paths.root, 'dist'),
      publicPath: '/',
    },
    client: {
      overlay: false,
    },
    compress: true,
    historyApiFallback: true,
    host: '127.0.0.1',
    hot: true,
    open: 'http://localhost:3002/',
    port: 3002,
  },
});
