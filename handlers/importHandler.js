const fs = require('fs');
const path = require('path');
const ts = require('typescript');

module.exports = function importHandler(value, context, request) {
  if (!/^#import/m.test(value)) return value;

  return value
    .replace(/^#import (.*);/m, function (includeStatement, file) {
      const importThisFile = file.replace(/['"]/g, '');
      const content = fs.readFileSync(path.join(context, importThisFile));
      if (importThisFile.endsWith('.ts')) {
        const { outputText } = ts.transpileModule(content.toString(), {
          compilerOptions: { module: ts.ModuleKind.CommonJS },
        });
        return JSON.stringify(eval(outputText));
      } else if (importThisFile.endsWith('.js')) {
        return JSON.stringify(eval(content.toString()));
      } else {
        return content;
      }
    })
    .replace(/\r\n?/g, '\n');
};
