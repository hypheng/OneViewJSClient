const child_process = require('child_process');
const co = require('co');
const config = require('./config');
const fts = require('./fts');
const addEnclosure = require('./addEnclosure');
const addProfile = require('./addProfile');
const addStorageSystem = require('./addStorageSystem');
const addVolume = require('./addVolume');

const addSshPass = function(ip) {
  return new Promise((resolve, reject) => {
    child_process.exec(`sh addSshPass.sh ${ip}`, (err, stdout, stderr) => {
      if (err) {
        console.error(`addSshPass fail: ${err}, stderr: ${stderr}`);
        reject(err);
        return;
      }
      console.log(`[${ip}] addSshPass succeed: ${stdout}`);
      resolve();
    });
  });
};
const getDCS = function(ip) {
  return new Promise((resolve, reject) => {
    child_process.exec(`ssh ${ip} dcs status`, (err, stdout, stderr) => {
      console.log(`[${ip}] getDCS succeed: ${stderr} ${stdout}`);
      resolve(stdout);
    });
  });
};
const changeDCS = function(ip) {
  return new Promise((resolve, reject) => {
    child_process.exec(`ssh ${ip} dcs stop; ssh ${ip} dcs start ${config.dcsSchema} cold`, (err, stdout, stderr) => {
      console.log(`[${ip}] changeDCS succeed: ${stderr} ${stdout}`);
      resolve();
    });
  });
};
const waitForDCS = function(ip) {
  return co(function*() {
    let isDCSRunning;
    let matchSchema;
    do {
      const dcs = yield getDCS(ip);
      isRunning = dcs.search(/DCS is Running/);
      matchSchema = dcs.search(new RegExp('Schematic used:  ' + config.dcsSchema));
      console.log(`[${ip}] dcs isRunning=${isRunning} matchSchema=${matchSchema}`);
      if (isRunning === -1 || matchSchema === -1) {
        yield changeDCS(ip);
        yield new Promise((resolve, reject) => {
          setTimeout(resolve, 3000);
        });
      } else {
        break;
      }
    } while (true)
  });
}

co(function*() {
  const { oneviews, staticIPs } = config;
  const promises = oneviews.map((oneviewIP, index) => {
    return co(function *() {
      yield addSshPass(oneviewIP);
      yield waitForDCS(oneviewIP);
      yield fts(oneviewIP, staticIPs[index]);
      yield addEnclosure(staticIPs[index]);
      yield addProfile(staticIPs[index]);
      yield addStorageSystem(staticIPs[index]);
      yield addVolume(staticIPs[index]);
    });
  });
  yield Promise.all(promises);
}).then(() => {
  console.log('Done');
}).catch((err) => {
  if (err instanceof Error) {
    console.error(`${err.message}, stack:${err.stack}`);
  } else {
    console.error(JSON.stringify(err));
  }
});
