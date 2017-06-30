const request = require('request-promise');
const co = require('co');
/*
 * Create OneView client
 * All API returns promise
 */
module.exports = function OneViewClient(address, credential, ignoreCert) {
  this.address = address;
  this.credential = credential;
  this.ignoreCert = ignoreCert;
  this.request = request.defaults({
    baseUrl: `https://${address}`,
    rejectUnauthorized: !ignoreCert,
    json: true, // auto parse response body
    forever: true, // connection: keep-alive
    timeout: 30000, // 30 seconds timeout
  });

  // This function set the header permanently in client
  // To set header temporary, just pass the header in the options
  this.addHeader = function addHeader(key, value) {
    this.request = this.request.defaults({
      headers: {
        [key]: value,
      },
    });
  };

  this.login = function login() {
    return co(function* loginGen() {
      const loginResponseBody = yield this.request.post({
        uri: '/rest/login-sessions',
        headers: {
          'X-API-Version': 120, // support from OneView 1.20
        },
        body: credential,
      });

      // Get appliance supported API version
      const applianceAPIVersion = yield this.request.get({
        uri: '/rest/version',
        headers: {
          'X-API-Version': 120, // support from OneView 1.20
        },
      });

      this.request = this.request.defaults({
        headers: {
          auth: loginResponseBody.sessionID,
          'X-API-Version': applianceAPIVersion.currentVersion,
        },
      });
    }.bind(this));
  };

  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
  HTTP_METHODS.forEach(function addHTTPMethod(method) {
    // return Promise
    this[method] = function generalHTTPMethod(options) {
      return this.request[method](options).catch(
        function errorHandler(err) {
          return co(function* loginAndRetryGen() {
            if (err.statusCode === 401) {
              yield this.login();
              return yield this.request[method](options);
            }
            throw err;
          }.bind(this));
        }.bind(this));
    };
  }.bind(this));

  this.getAllMembers = function getAllMembers(options) {
    return co(function* getAllGen() {
      let start = 0;
      let all = [];
      let resourceList;
      do {
        resourceList = yield this.get({
          uri: `${options.uri}?start=${start}`,
        });
        all.push(...resourceList.members);
        start += resourceList.count;
      } while (start < resourceList.total);
      return all;
    }.bind(this));
  };

  // Return associated resource URI of the task
  this.waitTaskComplete = function waitTaskComplete(taskUri) {
    return co(function* waitTaskCompleteGen() {
      let task;
      do {
        task = yield this.get({
          uri: taskUri,
        }).catch(() => {
          return null;
        });
        yield this.wait(1000);
      } while (!task ||
          // storage task will be in following state when percentComplete is 100
          !task.taskState || task.taskState === 'New' || task.taskState === 'Running' ||
          //task percentComplete can be 0 but taskState = Completed in some API
          (task.percentComplete !== 100 && task.taskState !== 'Completed'));

      if (task.taskState === 'Completed' || task.taskState === 'Warning') {
        return yield this.get({
          uri: task.associatedResource.resourceUri,
        });
      } else {
        throw task;
      }
    }.bind(this));
  };

  this.wait = function wait(ms) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, ms);
    });
  };
};
