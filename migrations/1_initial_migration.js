const Migrations = artifacts.require("Migrations");

module.exports = async function(deployer, network, acc) {
  console.log(network, acc[0]);

  if (network === "mainnet" && !process.env.ADMIN_ADDRESS) {
    throw new Error("Admin address not set.");
  }
  //await deployer.deploy(Migrations);
};
