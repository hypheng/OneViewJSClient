const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Tested only again 3.00 OneView
module.exports = function checkAlive(ips) {
  return co(function*() {
    if (ips.length < 1) return;

    const startTime = new Date();
    const oneviews = {};

    for(let ip of ips) {
      const client = new OneViewClient(ip, config.credential, true, 300);
      yield client.login();
      oneviews[ip] = { client };
    }

    while(true) {
      let count = 0;
      for(let ip of ips) {
        yield oneviews[ip].client.get({uri: '/rest/enclosures'}).then(
          () => {
            if (oneviews[ip].failureTime !== null) {
              oneviews[ip].failureTime = null;
              console.info(`${ip} is alive`);
            }
          },
          err => {
            if (!oneviews[ip].failureTime) {
              oneviews[ip].failureTime = new Date();
            }
            console.error(`${ip} is not alive at ${new Date().toString()}, iteration[${count}]`);
          }
        );
      }
      count = count + 1;
      yield oneviews[ips[0]].client.wait(1000);
    }
  });
};

function duration(start) {
  return Math.round((new Date() - start)/1000);
}

if (require.main === module) {
  process.argv.shift();
  process.argv.shift();
  module.exports(process.argv).then(() => {
    console.log('Done');
  }).catch((err) => {
    console.error(`${err.message}, stack:${err.stack}`);
  });
}
