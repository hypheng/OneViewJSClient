const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Refresh enclosures into OneView
// Tested only against 3.00 OneView
module.exports = function addEnclosure(ip) {
  return co(function*() {
    const client = new OneViewClient(ip, config.credential, true);
    yield client.login();

    const enclosureAddresses = config['enclosures'];
    let enclosure;
    let task;

    const existingEnclosures = yield client.getAllMembers({
      uri: '/rest/enclosures',
    });

    // Refresh enclosures into OneView
    let promises = [];
    for(let i = 0; i < existingEnclosures.length; i += 1) {
      if (existingEnclosures[i].status === 'Critical') {
        promises.push(co(function* refreshEnclosureGen() {
          const putEnclRes = yield client.put({
            uri: existingEnclosures[i].uri + '/refreshState',
            resolveWithFullResponse: true,
            body: {
              "refreshState": "RefreshPending",
              "refreshForceOptions": {
                "address": existingEnclosures[i].activeOaPreferredIP,
                "username": "dcs",
                "password": "dcs"
              }
            },
          });
          console.log(`[${ip}] enclosure ${existingEnclosures[i].activeOaPreferredIP} is put, task: ${putEnclRes.headers.location}`);
          enclosure = yield client.waitTaskComplete(putEnclRes.headers.location).catch(err => {
            console.log(`[${ip}] enclosure ${existingEnclosures[i].activeOaPreferredIP} is not refreshed because ${err.taskErrors[0].message}`);
            return null;
          });
          if (enclosure) {
            console.log(`[${ip}] enclosure ${existingEnclosures[i].activeOaPreferredIP} is refreshed`);
          }
        }));

        // concurrency
        if ((i + 1) % 4 === 0) {
          yield Promise.all(promises);
          promises = [];
        }
      }
    }
  });
};

if (require.main === module) {
  module.exports(process.argv[2]).then(() => {
    console.log('Done');
  }).catch((err) => {
    if (err instanceof Error) {
      console.error(`[${process.argv[2]}] ${err.message}, stack:${err.stack}`);
    } else {
      console.error(JSON.stringify(err));
    }
  });
}
