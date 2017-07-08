const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Add enclosures into OneView
// Tested only against 3.00 OneView
module.exports = function addEnclosure(ip) {
  return co(function*() {
    const client = new OneViewClient(ip, config.credential, true);
    yield client.login();

    const enclosureAddresses = config['enclosures'];
    const DefaultEnclosureGroupName = 'defaultEnclosureGroup';
    let eg;
    let enclosure;
    let task;

    const egList = yield client.get({
      uri: '/rest/enclosure-groups',
    });

    let egArray = egList.members.filter((eg) => {
      return eg.name === DefaultEnclosureGroupName;
    });

    if (egArray.length === 0) {
      // Create default enclosure group
      const postEGRes = yield client.post({
        uri: '/rest/enclosure-groups',
        resolveWithFullResponse: true,
        body: {
          type: 'EnclosureGroupV400',
          name: DefaultEnclosureGroupName,
          interconnectBayMappings: [],
          interconnectBayMappingCount: 0,
          stackingMode: 'Enclosure',
          configurationScript: '',
          uri: null,
          powerMode: null,
          ipRangeUris: [],
          enclosureCount: 1,
          osDeploymentSettings: null,
          enclosureTypeUri: '/rest/enclosure-types/c7000',
        },
      });
      console.log(`[${ip}] default enclosure group is posted, task: ${postEGRes.headers.location}`);
      eg = yield client.waitTaskComplete(postEGRes.headers.location);
      console.log(`[${ip}] default enclosure group is created`);
    } else {
      eg = egArray[0];
    }

    const existingEnclList = yield client.get({
      uri: '/rest/enclosures',
    });

    // Add enclosures into OneView
    let promises = [];
    for(let i = 0; i < enclosureAddresses.length; i += 1) {
      promises.push(co(function* creatEnclosureGen() {
        const enclosureAddress = enclosureAddresses[i];
        const enclosureArray = existingEnclList.members.filter((enclosure) => {
          return enclosure.activeOaPreferredIP === enclosureAddress;
        });
        // if the enclosure is not already in OneView
        if (enclosureArray.length === 0) {
          const postEnclRes = yield client.post({
            uri: '/rest/enclosures',
            resolveWithFullResponse: true,
            body: {
              enclosureGroupUri: eg.uri,
              firmwareBaselineUri: null,
              force: false,
              forceInstallFirmware: false,
              hostname: enclosureAddress,
              licensingIntent: 'OneView',
              updateFirmwareOn: null,
              username: 'dcs',
              password: 'dcs',
            },
          });
          console.log(`[${ip}] enclosure ${enclosureAddress} is posted, task: ${postEnclRes.headers.location}`);
          enclosure = yield client.waitTaskComplete(postEnclRes.headers.location).catch(err => {
            console.log(`[${ip}] enclosure ${enclosureAddress} is not added because ${err.taskErrors[0].message}`);
            return null;
          });
          if (enclosure) {
            console.log(`[${ip}] enclosure ${enclosureAddress} is added`);
          }
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
      console.error(`[${process.argv[2]}] ${err.message}, stack:${err.stack}`);
    } else {
      console.error(JSON.stringify(err));
    }
  });
}
