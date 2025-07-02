#!/usr/bin/env bun

import solver from "@cap.js/solver";
import kleur from "kleur";

const args = process.argv.slice(2);

(async () => {
  if (args.length === 0) {
    console.log(`${kleur.bold("@cap.js/cli")} ${kleur.gray(
      "cli solver for cap challenges"
    )}${
      !process.versions?.bun
        ? `\n\n ${kleur.yellow().bold("warn")}${kleur.dim(
            ":"
          )} bun is not installed and recommended`
        : ""
    }

Usage:
  ${kleur.dim("$")} ${kleur.bold().green("bunx @cap.js/cli")} ${kleur.cyan(
      "<challenges>"
    )}

Options:
  ${kleur.cyan("<challenges>")}  The challenges to solve in
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

  console.log(
    `${kleur.cyan("@cap.js/cli")} ${kleur.dim(
      `${challenges.length} challenges`
    )}\n\n\n`
  );

  const start = performance.now();

  await solver(challenges, {
    onProgress: (status) => {
      process.stdout.moveCursor(0, -2);
      process.stdout.clearScreenDown();
      console.log(
        `${status.result.salt}:${status.result.target}:${status.result.nonce}`
      );
      console.log(kleur.dim("\nSolving challenges… " + status.progress + "%"));
    },
  });

  const end = performance.now();
  
  process.stdout.moveCursor(0, -2);
  process.stdout.clearScreenDown();
  console.log(
    kleur.dim(`\nSolved challenges in ${kleur.bold(Math.round(end - start))}ms`)
  );
})();
