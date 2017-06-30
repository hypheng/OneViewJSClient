const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Add storage systems and storage pools into OneView
// Tested only again 3.00 OneView
module.exports = function addStorageSystem(ip) {
  return co(function*() {
    const client = new OneViewClient(ip, config.credential, true);
    yield client.login();

    const existingStorageSystemList = yield client.get({
      uri: '/rest/storage-systems?count=40',
    });

    const storageSystemAddresses = config['storage-systems'];
    let storageSystem;
    let task;
    for(let i = 0; i < storageSystemAddresses.length; i += 1) {
      const storageSystemAddress = storageSystemAddresses[i];
      const storageSystemArray = existingStorageSystemList.members.filter((storageSystem) => {
        return storageSystem.hostname === storageSystemAddress;
      });
      if (storageSystemArray.length === 0 ) {
        const postRes = yield client.post({
          uri: '/rest/storage-systems',
          resolveWithFullResponse: true,
          body: {
            'hostname': storageSystemAddress,
            'username': 'dcs',
            'password': 'dcs',
            'family' : 'StoreServ',
          },
        });
        console.log(`[${ip}] ${storageSystemAddress} is posted, task: ${postRes.headers.location}`);
        storageSystem = yield client.waitTaskComplete(postRes.headers.location);
        console.log(`[${ip}] ${storageSystemAddress} is ${storageSystem.state}`);
      } else if (storageSystemArray.length === 1) {
        storageSystem = storageSystemArray[0];
      } else {
        console.error(`[${ip}] two same storage system with same address ${JSON.stringify(storageSystemArray)}`);
        return;
      }

      if (storageSystem.deviceSpecificAttributes.managedDomain === config.storageSystemDomain) {
        continue;
      }

      // Add storage-pools into storage-system
      delete storageSystem.displayName;
      delete storageSystem.totalCapacity;
      delete storageSystem.allocatedCapacity;
      delete storageSystem.freeCapacity;
      delete storageSystem.state;
      delete storageSystem.status;
      delete storageSystem.modified;
      delete storageSystem.lastRefreshTime;
      storageSystem.deviceSpecificAttributes.discoveredDomains = storageSystem.deviceSpecificAttributes.discoveredDomains.filter(
        domain => domain !== config.storageSystemDomain
      );
      storageSystem.deviceSpecificAttributes.managedDomain = config.storageSystemDomain;
      storageSystem.deviceSpecificAttributes.managedPools = storageSystem.deviceSpecificAttributes.discoveredPools.filter(
        pool => pool.domain === config.storageSystemDomain
      );
      // don't assign discoveredPools before assign managedPools
      storageSystem.deviceSpecificAttributes.discoveredPools = storageSystem.deviceSpecificAttributes.discoveredPools.filter(
        pool => pool.domain !== config.storageSystemDomain
      );

      const putRes = yield client.put({
        uri: storageSystem.uri,
        resolveWithFullResponse: true,
        headers: {
          'If-Match': storageSystem.eTag,
        },
        body: storageSystem,
      });
      console.log(`[${ip}] storage-pools are put into storage-system, task: ${putRes.headers.location}`);
      storageSystem = yield client.waitTaskComplete(putRes.headers.location);
      console.log(`[${ip}] storage-pools are in storageSystemUri`);
    }
  });
};

if (require.main === module) {
  module.exports(process.argv[2]).then(() => {
    console.log('Done');
  }).catch((err) => {
    if (err instanceof Error) {
      console.error(`[${process.argv[2]}] ${err.name} ${err.message}, stack:${err.stack}`);
    } else {
      console.error(`[${process.argv[2]}] ${JSON.stringify(err)}`);
    }
  });
}
