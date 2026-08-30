const path = require('path');

module.exports = {
  dependencies: {
    'react-native-coverage': {
      root: path.join(__dirname, '..'),
    },
    'coverage-fixture': {
      root: path.join(__dirname, '../example/fixture-lib'),
    },
  },
};
