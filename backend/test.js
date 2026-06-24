const dns = require("dns");

dns.resolveSrv(
  "_mongodb._tcp.cluster0.2kaw419.mongodb.net",
  (err, addresses) => {
    if (err) {
      console.log("ERROR:");
      console.log(err);
      return;
    }

    console.log("SUCCESS:");
    console.log(addresses);
  }
);