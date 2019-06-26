module.exports = function headerHandlers(value, request) {
  if (!/^#eval/m.test(value)) return value;
  return value
    .replace(/^#eval (.*);/m, function (statement, val) {
    const expression = val.replace(/[${}]/g, '');
    return eval(expression);
  })
    .replace(/\r\n?/g, '\n');
}
