const ignoreFields = {abi: true, bytecode: true};
const jsondiffpatchLib = require("jsondiffpatch");
const jsondiffpatch = require("jsondiffpatch").create({
  propertyFilter: function(name, context) {
    return !ignoreFields[name];
  }
});

const fs = require("fs");

const fileLeft = process.argv[2];
const fileRight = process.argv[3];

if (!fileLeft || !fileRight) {
  console.log("\n  USAGE: jsondiffpatch left.json right.json");
  return;
}

const left = JSON.parse(fs.readFileSync(fileLeft));
const right = JSON.parse(fs.readFileSync(fileRight));

const delta = jsondiffpatch.diff(left, right);
jsondiffpatchLib.console.log(delta);
