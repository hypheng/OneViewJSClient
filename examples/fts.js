const co = require('co');

const OneViewClient = require('..');
const config = require('./config');

// Add enclosures into OneView
// Tested only against 3.00 OneView
co(function*() {
  let initialCredential = Object.assign({}, config.credential);
  initialCredential.password = 'admin';
  let client = new OneViewClient(process.argv[2], initialCredential, true);
  console.log('accept eula');
  const eulaResBody = yield client.post({
    uri: '/rest/appliance/eula/save',
    body: { supportAccess: 'yes' },
  });
  console.log('eula accepted');

  console.log('login with initial password');
  let loginSuccess = yield client.login().catch((err) => {
    if (err.statusCode === 403) {
      return Promise.resolve(true);
    } else {
      console.log('login with initial password failed');
      return Promise.reject(err);
    }
  });

  if (loginSuccess) {
    console.log('change password');
    const changePasswordBody = yield client.post({
      uri: '/rest/users/changePassword',
      body: {"userName":"administrator","oldPassword":"admin","newPassword":"hpvse123"},
    });
    console.log('password changed');
  }

  client = new OneViewClient(process.argv[2], config.credential, true);
  console.log('login with new password');
  yield client.login();

  console.log('get default network setting');
  const initNetwork = yield client.get({
    uri: '/rest/appliance/network-interfaces',
  });

  console.log('init network');
  const hostname = process.argv[3].replace(/\./g, '-');
  const initNetworkRes = yield client.post({
    uri: '/rest/appliance/network-interfaces',
    body: {
      "type":"ApplianceNetworkConfiguration",
      "applianceNetworks":[  
      {  
        "activeNode":1,
        "unconfigure":false,
        "app1Ipv4Addr":process.argv[3],
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
  console.log('network configuration is sent');

  client = new OneViewClient(process.argv[3], config.credential, true);
  loginSuccess = false;
  while (!loginSuccess) {
    yield client.wait(3000);
    console.log('check new IP');
    loginSuccess = yield client.login()
      .then(() => {
        console.log('login with new password succeed');
        return Promise.resolve(true);
      }, (err) => {
        console.log('login with new password failed');
        return Promise.resolve(false);
      });
  }
  console.log('new IP is accessible');
}).then(() => {
  console.log('Done');
}).catch((err) => {
  if (err instanceof Error) {
    console.error(`${err.message}, stack:${err.stack}`);
  } else {
    console.error(JSON.stringify(err));
  }
});
