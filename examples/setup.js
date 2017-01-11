const co = require('co');
const config = require('./config');
const fts = require('./fts');
const addEnclosure = require('./addEnclosure');
const addProfile = require('./addProfile');
const addStorageSystem = require('./addStorageSystem');
const addVolume = require('./addVolume');

co(function*() {
  const { oneviews, staticIPs } = config;
  const promises = oneviews.map((oneviewIP, index) => {
    return co(function *() {
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
