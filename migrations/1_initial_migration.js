module.exports = async function(deployer, network, acc) {
  if (network.includes("coverage") || network.includes("test")) {
    console.log("Skipping migrations due not needed for coverage or test");
    return;
  }
  if (network === "mainnet" && !process.env.ADMIN_ADDRESS) {
    throw new Error("Admin address not set.");
  }
};
