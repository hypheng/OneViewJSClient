const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

co(function*() {
  const client = new OneViewClient(config.oneviewAddress, config.credential, true);
  yield client.login();

  const storageSystemAddresses = config['storage-systems'];
  for(let i = 0; i < storageSystemAddresses.length; i += 1) {
    const storageSystemAddress = storageSystemAddresses[i];
    yield client.post({
      uri: '/rest/storage-systems',
      body: {
        'ip_hostname': storageSystemAddress,
        'username': 'dcs',
        'password': 'dcs',
      },
    });
    console.log(`storage system ${storageSystemAddress} is added to ${config.oneviewAddress}`);
  }
}).then(() => {
  console.log('Done');
}).catch((err) => {
  console.error(`${err.name} ${err.message}, stack:${err.stack}`);
});
