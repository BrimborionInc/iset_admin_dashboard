module.exports = {
  extends: ['react-app', 'react-app/jest'],
  rules: {
    // Disallow raw fetch calls to internal API paths; enforce apiFetch wrapper usage
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.name='fetch'] Literal[value^='/api/']",
        message: 'Use apiFetch for authenticated /api calls.'
      },
      {
        selector: "CallExpression[callee.name='fetch'] TemplateLiteral > TemplateElement[value.raw^='/api/']",
        message: 'Use apiFetch for authenticated /api calls.'
      }
    ]
  }
};
