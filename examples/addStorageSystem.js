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
      uri: '/rest/storage-systems',
    });

    const storageSystemAddresses = config['storage-systems'];
    let storageSystem;
    let task;
    for(let i = 0; i < storageSystemAddresses.length; i += 1) {
      const storageSystemAddress = storageSystemAddresses[i];
      const storageSystemArray = existingStorageSystemList.members.filter((storageSystem) => {
        return storageSystem.credentials.ip_hostname === storageSystemAddress;
      });
      if (storageSystemArray.length === 0 ) {
        const postRes = yield client.post({
          uri: '/rest/storage-systems',
          resolveWithFullResponse: true,
          body: {
            'ip_hostname': storageSystemAddress,
            'username': 'dcs',
            'password': 'dcs',
          },
        });
        console.log(`[${ip}] is posted, task: ${postRes.headers.location}`);
        storageSystem = yield client.waitTaskComplete(postRes.headers.location);
        console.log(`[${ip}] ${storageSystemAddress} is ${storageSystem.state}`);
      } else if (storageSystemArray.length === 1) {
        storageSystem = storageSystemArray[0];
      } else {
        console.error(`[${ip}] two same storage system with same address ${JSON.stringify(storageSystemArray)}`);
      }

      // Add storage-pools into storage-system
      const storagePools = [].concat(storageSystem.unmanagedPools, storageSystem.managedPools)
        .filter(storagePool => storagePool.domain === config.storageSystemDomain)
        .map((storagePool) => {
          return {
            deviceType: storagePool.deviceType,
            domain: storagePool.domain,
            name: storagePool.name,
            type: 'StoragePool',
          };
        });
      const unmanagedPorts = storageSystem.unmanagedPorts.map((unmanagedPort) => {
        return {
          actualNetworkSanUri: unmanagedPort.actualNetworkSanUri,
          actualNetworkUri: unmanagedPort.actualNetworkUri,
          expectedNetworkUri: unmanagedPort.expectedNetworkUri,
          groupName: unmanagedPort.groupName,
          label: unmanagedPort.label,
          name: unmanagedPort.name,
          portName: unmanagedPort.portName,
          portWwn: unmanagedPort.portWwn,
          protocolType: unmanagedPort.protocolType,
          type: unmanagedPort.type,
        };
      });
      const putRes = yield client.put({
        uri: storageSystem.uri,
        resolveWithFullResponse: true,
        headers: {
          'If-Match': storageSystem.eTag,
        },
        body: {
          credentials: storageSystem.credentials,
          eTag: storageSystem.eTag,
          managedDomain: config.storageSystemDomain,
          managedPools: storagePools,
          managedPorts: [],
          name: storageSystem.name,
          serialNumber: storageSystem.serialNumber,
          type: storageSystem.type,
          unmanagedPorts,
          uri: storageSystem.uri,
        },
      });
      console.log(`[${ip}] storage-pools are put into storage-system, task: ${putRes.headers.location}`);
      storageSystem = yield client.waitTaskComplete(putRes.headers.location);
      console.log(`[${ip}] ${storageSystem.managedPools.length} storage-pools are in storageSystemUri`);
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
