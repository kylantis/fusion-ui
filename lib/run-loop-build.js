
const shelljs = require('shelljs');

while (true) {
  const result = shelljs.exec('npm run build');
  if (result.code !== 0) {
    throw new Error(result.text);
  }
}
