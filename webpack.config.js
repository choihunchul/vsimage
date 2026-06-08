const path = require('path');
const webpack = require('webpack');

function formatBuildTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

module.exports = (_env, argv) => {
  const isProduction = argv.mode === 'production';
  const buildTime = formatBuildTimestamp(new Date());

  return {
    entry: './src/extension.ts',
    target: 'node',
    mode: argv.mode || 'development',
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [{ loader: 'ts-loader' }]
        }
      ]
    },
    output: {
      filename: 'extension.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'commonjs'
    },
    externals: {
      vscode: 'commonjs vscode'
    },
    devtool: 'source-map',
    plugins: [
      new webpack.DefinePlugin({
        __VSIMAGE_BUILD_TIME__: JSON.stringify(isProduction ? '' : buildTime)
      })
    ]
  };
};
