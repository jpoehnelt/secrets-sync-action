#!/usr/bin/env -S deno run -Aq
import process from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert";
import * as core from "npm:@actions/core@^1.10.0";
import { $ } from "npm:zx@^7.2.2";

globalThis.addEventListener("error", (e) => core.setFailed(e.error.message));

$.verbose = false;
if (core.isDebug()) {
  $.verbose = true;
}

async function findAllRepositories(query: string): Promise<string> {
  return (
    await $`gh search repos -L 500 ${query} --json fullName -q .[].fullName`
  )
    .toString()
    .trim();
}

const token = core.getInput("token", { required: true });
process.env.GITHUB_TOKEN = token;
const githubServerURL = core.getInput("github_server_url", { required: true });
process.env.GITHUB_SERVER_URL = githubServerURL;

const dryRun = core.getBooleanInput("dry_run", { required: true });

let repositories = core.getInput("repositories");
const repository = core.getInput("repository");
const query = core.getInput("query");
assert(
  repositories || repository || query,
  "Must provide either repositories or query"
);
repositories ||= repository;
repositories ||= await findAllRepositories(query);
core.startGroup("repositories");
core.info(repositories);
core.endGroup();

const app = core.getInput("app", { required: true });
assert(
  ["actions", "codespaces", "dependabot"].includes(app),
  "app must be {actions|codespaces|dependabot}"
);

let secrets = core.getInput("secrets");
const secret = core.getInput("secret");
assert(secrets || secret, "Must provide either secrets or secret");
secrets ||= secret;
core.startGroup("secrets");
core.info(secrets);
core.endGroup();

const envFile = await Deno.makeTempFile({ suffix: ".env" });
globalThis.addEventListener("unload", () => Deno.removeSync(envFile));
await writeFile(envFile, secrets);
if (core.isDebug()) {
  core.startGroup(envFile);
  core.info(await readFile(envFile));
  core.endGroup();
}

const results = await Promise.allSettled(
  repositories
    .split(/\r?\n/g)
    .map((r) =>
      dryRun
        ? core.info(`gh secret set -R ${r} -a ${app} -f ${envFile}`)
        : $`gh secret set -R ${r} -a ${app} -f ${envFile}`.then(() =>
            core.info(`Successfully set ${r} ${app} secrets from ${envFile}`)
          )
    )
);
const failed = results.filter(
  (r): r is PromiseRejectedResult => r.status === "rejected"
);
if (failed.length) {
  throw new AggregateError(failed.map((r) => r.reason));
}
