const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Create server profiles in OneView
// Tested only again 3.00 OneView
module.exports = function addProfile(ip) {
  return co(function*() {
    const client = new OneViewClient(ip, config.credential, true);
    yield client.login();

    const servers = yield client.getAllMembers({
      uri: '/rest/server-hardware/',
    });
    const profiles = yield client.getAllMembers({
      uri: '/rest/server-profiles/',
    });
    console.log(`[${ip}] There exist ${profiles.length} profiles ${servers.length} servers`);

    const profileNames = new Set(profiles.map(profile => profile.name));
    let promises = [];
    for(let i = 0; i < servers.length; i += 1) {
      const server = servers[i];
      const newProfileName = `${server.name}-profile`;
      promises.push(co(function* creatVolumeGen() {
        if (!profileNames.has(newProfileName)) {
          const postRes = yield client.post({
            uri: '/rest/server-profiles',
            resolveWithFullResponse: true,
            body: {
              name: newProfileName,
              type: 'ServerProfileV5',
              serverHardwareUri: config.createEmptyProfile ? null : server.uri,
              serverHardwareTypeUri: server.serverHardwareTypeUri,
              enclosureGroupUri: server.serverGroupUri,
              serialNumberType: 'Virtual',
              macType: 'Virtual',
              wwnType: 'Virtual',
              description: '',
              affinity: 'Bay',
              connections: [],
              bootMode: null,
              firmware: {
                manageFirmware: false,
                firmwareBaselineUri: '',
                forceInstallFirmware: false,
                firmwareInstallType: null,
              },
              bios: {
                manageBios: false,
                overriddenSettings: [],
              },
              hideUnusedFlexNics: true,
              localStorage: {
                controllers: [],
              },
              sanStorage: null,
            },
          }).catch(err => {
            console.log(`[${ip}] post profile error for ${newProfileName}, ${err.message}`);
            return null;
          });
          if (postRes) {
            console.log(`[${ip}] server profile is posted, task: ${postRes.headers.location}`);
            const profile = yield client.waitTaskComplete(postRes.headers.location).catch(err => {
              console.log(`[${ip}] server profile ${newProfileName} is not created because ${err.taskErrors ? JSON.stringify(err) : err.taskErrors[0].message}`);
              return null;
            });
            if (profile) {
              console.log(`[${ip}] server profile ${profile.name} is created`);
            }
          }
        }
      }));

      // concurrency
      if ((i + 1) % 16 === 0) {
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
    console.error(`[${ip}] ${err.message}, stack:${err.stack}`);
  });
}
