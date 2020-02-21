const spawn = require("child_process").spawn;
const version = require("./package.json").version;
const {copyFileSync} = require("fs");

async function jsondiff() {
  const cmd = spawn("npx jsondiffpatch", ["./contracts.json ./old.contracts.json"], {
    shell: true,
    stdio: "inherit"
  });

  cmd.on("exit", code => console.log(code));
}

function copyFile(args) {
  return copyFileSync;
}

module.exports = async (deployer, network, accounts) => {
  console.log("Compare old and new contracts");
  const compareFiles = ["./contracts.json", "./old.contracts.json"];
  await jsondiff(compareFiles);

  console.log(`Generating metadata file: contracts_${version}.json`);
  copyFileSync("./contracts.json", `./contracts_${version}.json`);
};
