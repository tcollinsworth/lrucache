module.exports = {
  // https://eslint.org/docs/latest/use/configure/language-options#specifying-environments
  // https://github.com/eslint/eslint/discussions/15166
  // https://stackoverflow.com/questions/70916343/what-ecmascript-version-does-node-js-support
  env: {
    es2022: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 13
  },
  extends: 'airbnb-base',
  plugins: [
    'import',
    'unused-imports'
  ],
  rules: {
    semi: [2, 'never'],
    indent: [
      'error', 2,
      { SwitchCase: 1 },
    ],
    'unused-imports/no-unused-imports': 'error',
    'import/extensions': 0,
    'import/no-named-as-default': 0,
    'import/no-named-as-default-member': 0,
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'max-len': 'off',
    'import/prefer-default-export': 'off',
    'no-use-before-define': 'off',
    'no-plusplus': 'off',
    'no-continue': 'off',
    'no-param-reassign': 'off',
    'no-await-in-loop': 'off',
    'eqeqeq': 'off',
    'no-bitwise': 'off',
    'no-mixed-operators': 'off',
    'no-return-await': 'off',
    'no-extra-label': 'off',
    'no-labels': 'off',
    'prefer-rest-params': 'off',
    'no-underscore-dangle': 'off',
    'no-console': 'off'
  },
}
