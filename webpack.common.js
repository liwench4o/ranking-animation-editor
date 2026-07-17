import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const paths = {
  root: __dirname,
  dist: path.resolve(__dirname, 'dist'),
  index: path.resolve(__dirname, 'index.html'),
};

export function createCssLoaders(styleLoader) {
  return [
    styleLoader,
    {
      loader: 'css-loader',
      options: {
        importLoaders: 1,
      },
    },
    'postcss-loader',
  ];
}

export default {
  entry: {
    index: './src/index.tsx',
  },
  output: {
    filename: 'js/[name].bundle.js',
    chunkFilename: 'js/[name].chunk.js',
    assetModuleFilename: 'assets/[name].[contenthash:8][ext][query]',
    clean: true,
    path: paths.dist,
    publicPath: './',
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff2?|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(csv|tsv)$/i,
        loader: 'csv-loader',
        options: {
          dynamicTyping: true,
          header: true,
          skipEmptyLines: true,
        },
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
  },
  plugins: [
    new webpack.ProgressPlugin(),
    new HtmlWebpackPlugin({
      inject: true,
      title: 'Visual Foreshadowing',
      filename: 'index.html',
      template: paths.index,
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
      },
    }),
    new ForkTsCheckerWebpackPlugin(),
  ],
  optimization: {
    moduleIds: 'deterministic',
  },
};
