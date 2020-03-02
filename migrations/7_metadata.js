const spawn = require("child_process").spawn;
const version = require("../package.json").version;
const path = require("path");
const {copyFileSync, mkdirSync, existsSync} = require("fs");
const {NEW_METADATA, PRIOR_METADATA} = require("../scripts/helpers");

async function jsondiff(files) {
  const cmd = spawn(`node ${process.env.PWD}/scripts/diff.js`, files, {
    shell: true,
    stdio: "inherit"
  });
  cmd.on("exit", code => console.log(code));
}

const SUPPORTED_NETWORKS = [42, 1];

module.exports = async (deployer, network, accounts) => {
  if (network.includes("coverage") || network.includes("test")) {
    return;
  }
  const netId = await web3.eth.net.getId();

  console.log("\n\nCompare last version and new version:\n");
  const compareFiles = [
    `${process.env.PWD}/${PRIOR_METADATA}`,
    `${process.env.PWD}/${NEW_METADATA}`
  ];
  console.log(compareFiles);
  await jsondiff(compareFiles);

  if (SUPPORTED_NETWORKS.includes(netId)) {
    const metaDir = `${process.env.PWD}/metadata`;
    console.log(`Generating metadata file: metadata/contracts_${version}.json`);
    if (!existsSync(metaDir)) {
      mkdirSync(metaDir, 0744);
    }
    copyFileSync(`${process.env.PWD}/${NEW_METADATA}`, `${metaDir}/contracts_${version}.json`);
  } else {
    console.log("Not added to metadata folder due is not Kovan or Mainnet.");
  }
};
