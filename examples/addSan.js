const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Add san into OneView
// Tested only again 3.10 OneView
module.exports = function addSanManager(ip) {
  return co(function*() {
    const client = new OneViewClient(ip, config.credential, true);
    yield client.login();

    const providers = yield client.getAllMembers({
      uri: '/rest/fc-sans/providers',
    });

    const brocadeProvider = providers.find(provider => provider.displayName === 'Brocade Network Advisor');

    const existingSanManagers = yield client.getAllMembers({
      uri: '/rest/fc-sans/device-managers',
    });

    const sanManagerAddresses = config['san-managers'];
    let promises = [];
    for(let i = 0; i < sanManagerAddresses.length; i += 1) {
      promises.push(co(function* addSanManagerGen() {
        const sanManagerAddress = sanManagerAddresses[i];
        if (existingSanManagers.findIndex(esm => esm.name === sanManagerAddress) === -1 ) {
          const postRes = yield client.post({
            uri: brocadeProvider.uri + '/device-managers', // storage_scale/40 provides brocade advisor
            resolveWithFullResponse: true,
            body: {
              "connectionInfo": [
                  {
                    "name": "Host",
                    "displayName": "Host",
                    "required": true,
                    "value": sanManagerAddress,
                    "valueFormat": "IPAddressOrHostname",
                    "valueType": "String"
                  },
                  {
                    "name": "Port",
                    "displayName": "Port",
                    "required": true,
                    "value": 5989,
                    "valueFormat": "None",
                    "valueType": "Integer"
                  },
                  {
                    "name": "Username",
                    "displayName": "Username",
                    "required": true,
                    "value": "dcs",
                    "valueFormat": "None",
                    "valueType": "String"
                  },
                  {
                    "name": "Password",
                    "displayName": "Password",
                    "required": true,
                    "value": "dcs",
                    "valueFormat": "SecuritySensitive",
                    "valueType": "String"
                  },
                  {
                    "name": "UseSsl",
                    "displayName": "UseSsl",
                    "required": true,
                    "value": true,
                    "valueFormat": "None",
                    "valueType": "Boolean"
                  }
                ],
            },
          });
          console.log(`[${ip}] ${sanManagerAddress} is posted, task: ${postRes.headers.location}`);
          sanManager = yield client.waitTaskComplete(postRes.headers.location);
          console.log(`[${ip}] ${sanManagerAddress} is ${sanManager.state}`);
        }
      }));

      // concurrency
      if ((i + 1) % 4 === 0) {
        yield Promise.all(promises);
        promises = [];
      }
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
