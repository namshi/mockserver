module.exports = function evalHandlers(value, request) {
  if (!/^#eval/m.test(value)) return value;
  return value
    .replace(/^#eval (.*);/m, function (statement, val) {
    return eval(val);
  })
    .replace(/\r\n?/g, '\n');
}
