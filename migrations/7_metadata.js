const spawn = require("child_process").spawn;
const version = require("./package.json").version;
const {copyFileSync, mkdirSync} = require("fs");

async function jsondiff() {
  const cmd = spawn("npx jsondiffpatch", ["./contracts.json ./old.contracts.json"], {
    shell: true,
    stdio: "inherit"
  });

  cmd.on("exit", code => console.log(code));
}

const SUPPORTED_NETWORKS = [42, 1];

module.exports = async (deployer, network, accounts) => {
  const netId = await web3.eth.net.getId();

  console.log("\n\nCompare last version and new version:\n");
  const compareFiles = ["./contracts.json", "./old.contracts.json"];
  await jsondiff(compareFiles);

  if (SUPPORTED_NETWORKS.includes(netId)) {
    console.log(`Generating metadata file: ${__dirname}/contracts_${version}.json`);
    const metaDir = __dirname + "/metadata";
    if (!path.existsSync(metaDir)) {
      fs.mkdirSync(dir, 0744);
    }
    copyFileSync("./contracts.json", `${metaDir}/contracts_${version}.json`);
  } else {
    console.log("Not added to metadata folder due is not Kovan or Mainnet.");
  }
};
