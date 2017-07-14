const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Reapply error server profiles in OneView
// Tested only again 3.00 OneView
module.exports = function addProfile(ip) {
  return co(function*() {
    const client = new OneViewClient(ip, config.credential, true);
    yield client.login();

    const profiles = yield client.getAllMembers({
      uri: '/rest/server-profiles/',
    });
    console.log(`[${ip}] There exist ${profiles.length} profiles`);

    let promises = [];
    for(let i = 0; i < profiles.length; i += 1) {
      const profile = profiles[i];
      if (profile.status === 'Critical') {
        promises.push(co(function* reapplyProfileGen() {
          profile.description = 'reapplied';
          const putRes = yield client.put({
            uri: profile.uri,
            resolveWithFullResponse: true,
            body: profile,
          }).catch(err => {
            console.log(`[${ip}] put profile error for ${profile.name}, ${err.message}`);
            return null;
          });
          if (putRes) {
            console.log(`[${ip}] server profile ${profile.uri} is put, task: ${putRes.headers.location}`);
            const newProfile = yield client.waitTaskComplete(putRes.headers.location).catch(err => {
              console.log(`[${ip}] server profile ${profile.name} is not reapplied because ${err.taskErrors ? JSON.stringify(err) : JSON.stringify(err.taskErrors)}`);
              return null;
            });
            if (newProfile) {
              console.log(`[${ip}] server profile ${newProfile.name} is reapplied`);
            }
          }
        }));
      }

      // concurrency
      if ((i + 1) % 8 === 0) {
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
    console.error(`[${process.argv[2]}] ${err.message}, stack:${err.stack}`);
  });
}
