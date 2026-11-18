module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'commonjs',
  },
  rules: {
    'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true }],
  },
};
