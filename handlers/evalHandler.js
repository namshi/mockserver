module.exports = function evalHandler(value, request) {
  if (!/^#eval/m.test(value)) return value;
  return value
    .replace(/^#eval (.*);/m, function (statement, val) {
    return eval(val);
  })
    .replace(/\r\n?/g, '\n');
}
