const util = require("util");
const spawn = require("child_process").spawn;

async function jsondiff() {
  const cmd = spawn("npx jsondiffpatch", ["./contracts.json ./old.contracts.json"], {
    shell: true,
    stdio: "inherit"
  });

  cmd.on("exit", code => console.log(code));
}

module.exports = async (deployer, network, accounts) => {
  console.log("Compare old and new contracts");
  await jsondiff();
};
