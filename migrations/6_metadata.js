const spawn = require("child_process").spawn;
const version = require("../package.json").version;
const pick = require("lodash/pick");
const path = require("path");
const {copyFileSync, writeFileSync, mkdirSync, existsSync} = require("fs");
const {NEW_METADATA, PRIOR_METADATA, getContracts} = require("../scripts/helpers");

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
  const currentContracts = await getContracts();
  currentContracts.version = version;
  writeFileSync(`${process.env.PWD}/${NEW_METADATA}`, JSON.stringify(currentContracts));

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
    console.log(`Generating full metadata file: metadata/contracts_full_${version}.json`);
    if (!existsSync(metaDir)) {
      mkdirSync(metaDir, 0744);
    }
    copyFileSync(`${process.env.PWD}/${NEW_METADATA}`, `${metaDir}/contracts_full_${version}.json`);

    console.log(`Generating simplified metadata file: metadata/contracts_${version}.json`);
    const simplifiedContracts = pick(currentContracts, ["address", "abi", "version"]);
    writeFileSync(`${metaDir}/contracts_${version}.json`, JSON.stringify(simplifiedContracts));
  } else {
    console.log("Not added to metadata folder due is not Kovan or Mainnet.");
  }
};
