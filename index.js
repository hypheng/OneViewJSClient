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
    timeout: 10000, // 10 seconds timeout
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

  this.waitTaskComplete = function waitTaskComplete(taskUri) {
    return co(function* waitTaskCompleteGen() {
      let task;
      do {
        task = yield this.get({
          uri: taskUri
        });
        yield this.wait(500);
      } while (task.percentComplete !== 100);

      return yield this.get({
        uri: task.associatedResource.resourceUri,
      });
    }.bind(this));
  };

  this.wait = function wait(ms) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, ms);
    });
  };
};
