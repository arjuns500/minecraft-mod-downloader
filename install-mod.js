#!/usr/bin/env node
const chalk = require("chalk");
const readline = require("readline");
const curseforge = require("mc-curseforge-api");
const mcpath = require("minecraft-folder-path");
const { mkdirSync, existsSync, readFileSync } = require("fs");
const { join } = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { describe } = require("yargs");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Install a mod, and also recursively
 * install all dependencies
 * @param {ModFile} mod
 * @param {String} version
 * @param {String} moddir
 */
function install_mod(mod, version, moddir) {
  mod &&
    mod.getDependenciesFiles &&
    mod
      .getDependenciesFiles()
      .then((deps) => {
        /**
         * Function to sort by date
         * This function should be used with the array.sort function
         * @param {*} a
         * @param {*} b
         */
        function filterDeps(a, b) {
          aDate = new Date(a.timestamp);
          bDate = new Date(b.timestamp);

          if (aDate < bDate) {
            return 1;
          } else if (aDate > bDate) {
            return -1;
          } else {
            return 0;
          }
        }
        deps.forEach((depArr) => {
          /**
           * Get the latest version of each dependency
           */
          var depToInstall = depArr
            .filter((el) => el.minecraft_versions.includes(version))
            .sort(filterDeps)[0];

          /*
           * Start the function again, so we can also install all
           * the dependencies of the dependency
           */
          install_mod(depToInstall, version, moddir);
        });
      })
      .then(async () => {
        /*
         * Download the mod to the correct location
         */
        await mod.download(moddir + mod.download_url.split("/").pop(), true);
        console.log(
          mod.download_url.split("/").pop() + " successfully installed"
        );
      });
}

var argv = yargs(hideBin(process.argv))
  .scriptName("install-mod")
  .usage("$0 <cmd> [args]")
  // Command to install mods
  .command(
    "install [mod] [mc_version]",
    "Install a mod",
    (yargs) => {
      yargs
        .positional("mod", {
          type: "string",
          describe: "Mod name to search for",
        })
        .positional("mc_version", {
          type: "string",
          describe: "Minecraft version to install for",
        });
    },
    ({ mod, mc_version }) => {
      curseforge
        .getMods({
          searchFilter: mod,
          sort: 5,
          gameVersion: mc_version,
        })
        .then((mods) => {
          if (mods.length == 0) {
            console.log(
              chalk`{red No mods found. Check for spelling errors or wrong version.}`
            );
            process.exit(1);
          }
          mods.map((mod) => {
            console.log(chalk`{bold {red ${mod.name}}}/{yellow ${mod.key}} {blue ${mod.primaryLanguage}} {cyan ID: {magenta ${mod.id}}}
      \t{green ${mod.summary}}
      `);
          });
        })
        .then(() => {
          rl.question("Mod to install (id): ", (id) => {
            curseforge.getModFiles(id).then((files) => {
              files = files.filter((file) =>
                file.minecraft_versions.includes(mc_version)
              );

              var modToInstall = files[files.length - 1];
              var moddir = join(mcpath, "mods", mc_version) + "/";
              if (!existsSync(moddir)) {
                mkdirSync(moddir, { recursive: true });
              }
              console.log("Installing to " + moddir);

              install_mod(modToInstall, mc_version, moddir);
              rl.close();
            });
          });
        });
    }
  )
  // Command to list all mods installed in the mc_mods.json
  .command(
    "list [mc_version]",
    "List the installed mods",
    (yargs) => {
      yargs.positional("mc_version", {
        type: "string",
        describe: "Minecraft version to list for",
      });
    },
    ({ mc_version }) => {
      var moddir = join(mcpath, "mods", mc_version) + "/";

      var json = JSON.parse(readFileSync(moddir + "mc_mods.json"));
      for (const mod in json.mods) {
        console.log(mod.name);
      }
    }
  )
  .help().argv;
