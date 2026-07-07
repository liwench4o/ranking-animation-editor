import net from 'node:net';
import path from 'node:path';
import { merge } from 'webpack-merge';
import common, { createCssLoaders, paths } from './webpack.common.js';

const isDevServer = process.argv.includes('serve') || process.env.WEBPACK_SERVE === 'true';

const host = '127.0.0.1';
const preferredPort = Number(process.env.PORT) || 3002;

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, host);
  });
}

async function findAvailablePort(startPort, maxAttempts = 20) {
  for (let port = startPort; port < startPort + maxAttempts; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return startPort;
}

export default async () => {
  const port = isDevServer ? await findAvailablePort(preferredPort) : preferredPort;

  return merge(common, {
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
      host,
      hot: true,
      open: `http://localhost:${port}/`,
      port,
    },
  });
};
