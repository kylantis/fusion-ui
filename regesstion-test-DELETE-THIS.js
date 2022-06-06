const { spawn } = require('child_process');
const pathLib = require('path');
const fs = require('fs');
spawn('npm run watch', { stdio: "inherit", shell: true });

setTimeout(() => {
    setInterval(() => {
        const p = pathLib.join(process.env.PWD, 'src', 'components', 'menu', 'index.view');
        fs.writeFileSync(p, fs.readFileSync(p));
    }, 60000);
}, 5000);