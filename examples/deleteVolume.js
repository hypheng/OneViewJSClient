const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Delete storage volumes into OneView
// Tested only again 3.00 OneView
module.exports = function addVolume(ip) {
  return co(function*() {
    const client = new OneViewClient(ip, config.credential, true);
    yield client.login();

    const volumes = yield client.getAllMembers({
      uri: '/rest/storage-volumes',
    });

    console.log(`[${ip}] There exist ${volumes.length} volumes`);

    for (let i = 0; i < volumes.length; i += 1) {
      const volume = volumes[i];
      const promises = [];
      for (let j = 0; j < 10; j +=1) {
        promises.push(co(function* creatVolumeGen() {
          if (volume.status === 'Critical') {
            const delRes = yield client.delete({
              uri: volume.uri,
              resolveWithFullResponse: true,
            }).catch(err => {
              console.log(`[${ip}] post volume error for ${volume.name}, ${err.message}`);
              return null;
            });
            if (delRes) {
              console.log(`[${ip}] volume is deleting, task: ${delRes.headers.location}`);
              yield client.waitTaskComplete(delRes.headers.location).catch(err => {
                console.log(`[${ip}] volume ${volume.name} is not deleted because` +
                    ` ${err.taskErrors && err.taskErrors.length > 0 ? err.taskErrors[0].message : JSON.stringify(err)}`);
                return null;
              });
            }
          }
        }));
      }
      yield Promise.all(promises);
    }
  });
};

if (require.main === module) {
  module.exports(process.argv[2]).then(() => {
    console.log('Done');
  }).catch((err) => {
    console.error(`[${process.argv[2]}] ${err.name} ${err.message}, stack:${err.stack}`);
  });
}
