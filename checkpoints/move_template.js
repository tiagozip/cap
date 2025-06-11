import fs from "fs/promises";

const template = await fs.readFile("./template.html", "utf-8");

const folders = (await fs.readdir("./", { withFileTypes: true }))
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name);

console.log(
  `build command:\n${folders
    .map((folder) => `cd ${folder} && bun publish --access public && cd ..`)
    .join("\n")}\n`
);

folders.forEach(async (folder) => {
  const path = `./${folder}/index.html`;
  await fs.writeFile(path, template);

  console.log(`wrote ${path}`);
});
