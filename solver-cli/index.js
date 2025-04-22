#!/usr/bin/env bun

import solver from "@cap.js/solver";
import kleur from "kleur";

const args = process.argv.slice(2);

(async () => {
  if (args.length === 0) {
    console.log(`\n${kleur.cyan("@cap.js/cli")} ${kleur.gray(
      "cli solver for cap challenges"
    )}

Usage:
  ${kleur.dim("$")} bunx ${kleur.bold("@cap.js/cli")} <challenges>

Options:
  <challenges>  The challenges to solve in
                format \`salt:target\``);
    return;
  }

  const challenges = args.map((arg) => {
    const [salt, target] = arg.split(":");

    if (!salt || !target) {
      console.error(
        `${kleur.red("Error:")} ${kleur.yellow(arg)} is not a valid challenge`
      );
      process.exit(1);
    }

    return [salt, target];
  });

  console.log(`\n${kleur.cyan("@cap.js/cli")} ${kleur.dim(`${challenges.length} challenges`)}\n\n\n`);

  const solutions = await solver(challenges, {
    onProgress: (status) => {
      process.stdout.moveCursor(0, -2);
      process.stdout.clearScreenDown();
      console.log(
        `${status.result.salt}:${status.result.target}:${status.result.nonce}`
      );
      console.log(kleur.dim("\nSolving challenges… " + status.progress + "%"));
    },
  });

  process.stdout.moveCursor(0, -2);
  process.stdout.clearScreenDown();
})();