module.exports = {
  env: { browser: true, es2020: true, node: true },
  extends: ['eslint:recommended', 'plugin:react-hooks/recommended', 'plugin:react/recommended'],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    requireConfigFile: false,
    babelOptions: { plugins: ['@babel/plugin-syntax-jsx'] },
  },
  plugins: ['react'],
  settings: { react: { version: '18.3' } },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': ['error', { args: 'none' }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
  },
};
