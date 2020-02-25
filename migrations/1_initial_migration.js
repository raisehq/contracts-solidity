module.exports = async function(deployer, network, acc) {
  if (network === "mainnet" && !process.env.ADMIN_ADDRESS) {
    throw new Error("Admin address not set.");
  }
};
