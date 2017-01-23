const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Create storage volumes into OneView
// Tested only again 3.00 OneView
module.exports = function addVolume(ip) {
  return co(function*() {
    const client = new OneViewClient(ip, config.credential, true);
    yield client.login();

    const storageSystems = yield client.getAllMembers({
      uri: '/rest/storage-systems',
    });

    const ssUriNameMap = storageSystems.reduce((map, storageSystem) => {
      map[storageSystem.uri] = storageSystem.name;
      return map;
    }, {});

    const storagePools = yield client.getAllMembers({
      uri: '/rest/storage-pools',
    });

    const volumes = yield client.getAllMembers({
      uri: '/rest/storage-volumes',
    });

    console.log(`[${ip}] There exist ${storagePools.length} storage-pools ${volumes.length} volumes`);

    const volumeNames = new Set(volumes.map(volume => volume.name));
    for (let i = 0; i < storagePools.length; i += 1) {
      const storagePool = storagePools[i];
      const promises = [];
      for (let j = 0; j < 8; j +=1) {
        promises.push(co(function* creatVolumeGen() {
          const newVolumeName = 
            `${ssUriNameMap[storagePool.storageSystemUri]}-${storagePool.name}-v${j}`;
          if (!volumeNames.has(newVolumeName)) {
            const postRes = yield client.post({
              uri: '/rest/storage-volumes',
              resolveWithFullResponse: true,
              body: {
                name: newVolumeName,
                description: '',
                templateUri: null,
                snapshotPoolUri: storagePool.uri,
                provisioningParameters: {
                  storagePoolUri: storagePool.uri,
                  requestedCapacity: '1073741824',
                  provisionType: 'Thin',
                  shareable: false
                },
              },
            }).catch(err => {
              console.log(`[${ip}] post volume error for ${newVolumeName}, ${err.message}`);
              return null;
            });
            if (postRes) {
              console.log(`[${ip}] volume is posted, task: ${postRes.headers.location}`);
              const volume = yield client.waitTaskComplete(postRes.headers.location).catch(err => {
                console.log(`[${ip}] volume ${newVolumeName} is not created because` +
                    ` ${err.taskErrors && err.taskErrors.length > 0 ? err.taskErrors[0].message : JSON.stringify(err)}`);
                return null;
              });
              if (volume) {
                console.log(`[${ip}] volume ${volume.name} is created`);
              }
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
    console.error(`[${ip}] ${err.name} ${err.message}, stack:${err.stack}`);
  });
}
