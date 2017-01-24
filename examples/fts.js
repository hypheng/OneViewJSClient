const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Do first time setup on OneView
// Tested only against 3.00 OneView
module.exports = function fts(oldIP, newIP) {
  return co(function*() {
    let initialCredential = Object.assign({}, config.credential);
    initialCredential.password = 'admin';
    let client = new OneViewClient(oldIP, initialCredential, true);
    console.log(`[${newIP}] accept eula`);
    const eulaResBody = yield client.post({
      uri: '/rest/appliance/eula/save',
      body: { supportAccess: 'yes' },
    });
    console.log(`[${newIP}] eula accepted`);

    console.log(`[${newIP}] login with initial password`);
    let loginSuccess = yield client.login().catch((err) => {
      if (err.statusCode === 403) {
        return Promise.resolve(true);
      } else {
        console.log(`[${newIP}] login with initial password failed`);
        return Promise.resolve(false);
      }
    });

    if (loginSuccess) {
      console.log(`[${newIP}] change password`);
      const changePasswordBody = yield client.post({
        uri: '/rest/users/changePassword',
        body: {"userName":"administrator","oldPassword":"admin","newPassword":"hpvse123"},
      });
      console.log(`[${newIP}] password changed`);
    }

    client = new OneViewClient(oldIP, config.credential, true);
    console.log(`[${newIP}] login with new password`);
    yield client.login();
    console.log(`[${newIP}] login with new password succeed`);

    console.log(`[${newIP}] check if network is initialized`);
    const networkConfiguredBody = yield client.get({
      uri: '/rest/global-settings/appliance/global/setup-network-configured',
    }).catch((err) => {
      return Promise.resolve({value: "false"});
    });

    if (networkConfiguredBody.value !== "true") {
      console.log(`[${newIP}] get default network setting`);
      const initNetwork = yield client.get({
        uri: '/rest/appliance/network-interfaces',
      });

      console.log(`[${newIP}] init network`);
      const hostname = newIP.replace(/\./g, '-');
      const initNetworkRes = yield client.post({
        uri: '/rest/appliance/network-interfaces',
        body: {
          "type":"ApplianceNetworkConfiguration",
          "applianceNetworks":[  
          {  
            "activeNode":1,
            "unconfigure":false,
            "app1Ipv4Addr":newIP,
            "app1Ipv6Addr":null,
            "app2Ipv4Addr":null,
            "app2Ipv6Addr":null,
            "virtIpv4Addr":null,
            "virtIpv6Addr":null,
            "app1Ipv4Alias":null,
            "app1Ipv6Alias":null,
            "app2Ipv4Alias":null,
            "app2Ipv6Alias":null,
            "hostname":`${hostname}.cn.hpecorp.net`,
            "confOneNode":true,
            "interfaceName":"",
            "macAddress":initNetwork.applianceNetworks[0].macAddress,
            "ipv4Type":"STATIC",
            "ipv6Type":"UNCONFIGURE",
            "overrideIpv4DhcpDnsServers":false,
            "ipv4Subnet":initNetwork.applianceNetworks[0].ipv4Subnet,
            "ipv4Gateway":initNetwork.applianceNetworks[0].ipv4Gateway,
            "ipv6Subnet":null,
            "ipv6Gateway":null,
            "domainName":"cn.hpecorp.net",
            "searchDomains":[  

            ],
            "ipv4NameServers":initNetwork.applianceNetworks[0].ipv4NameServers,
            "ipv6NameServers":[],
            "bondedTo":null,
            "aliasDisabled":true,
            "configureRabbitMqSslListener":false,
            "configurePostgresSslListener":false,
            "webServerCertificate":null,
            "webServerCertificateChain":null,
            "webServerCertificateKey":null
          }
          ],
          "serverCertificate":{  
            "rabbitMQCertificate":null,
            "rabbitMQRootCACertificate":null,
            "rabbitMQCertificateKey":null,
            "postgresCertificate":null,
            "postgresRootCACertificate":null,
            "postgresCertificateKey":null
          }
        }
      });
      console.log(`[${newIP}] network configuration is sent`);

      client = new OneViewClient(newIP, config.credential, true);
      loginSuccess = false;
      while (!loginSuccess) {
        yield client.wait(3000);
        console.log(`[${newIP}] check new IP`);
        loginSuccess = yield client.login()
          .then(() => {
            console.log(`[${newIP}] login with new password succeed`);
            return Promise.resolve(true);
          }, (err) => {
            console.log(`[${newIP}] login with new password failed`);
            return Promise.resolve(false);
          });
      }
      console.log(`[${newIP}] new IP is accessible`);
    } else {
      console.log(`[${newIP}] network is already initialized`);
    }
  });
};

if (require.main === module) {
  module.exports(process.argv[2], process.argv[3]).then(() => {
    console.log(`[${process.argv[3]}] Done`);
  }).catch((err) => {
    if (err instanceof Error) {
      console.error(`${err.message}, stack:${err.stack}`);
    } else {
      console.error(JSON.stringify(err));
    }
  });
}
