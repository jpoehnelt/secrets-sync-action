#!/usr/bin/env -S deno run -Aq
import process from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert";
import * as core from "npm:@actions/core@^1.10.0";
import { $ } from "npm:zx@^7.2.2";
import { temporaryWrite } from "npm:tempy@^3.1.0";

const dry$ = core.getBooleanInput("dry_run")
  ? (a: any, ...b: any[]) => console.log(String.raw({ raw: a }, ...b))
  : $;

async function searchRepositories(query: string): Promise<string[]> {
  // prettier-ignore
  return (await $`gh search repos -L 500 ${query} --json fullName -q .[].fullName`)
    .toString()
    .trim()
    .split(/\r?\n/g);
}

async function getRepositories() {
  if (core.getInput("repositories")) {
    return core.getMultilineInput("repositories");
  } else if (core.getInput("repository")) {
    return core.getMultilineInput("repository");
  } else if (core.getInput("query")) {
    return await searchRepositories(core.getInput("query"));
  } else {
    return undefined;
  }
}

async function setOrganizationSecrets(
  organization: string,
  secretsEnvFile: string,
  app: "actions" | "dependabot" | "codespaces",
  visibility: "private" | "all" | "selected",
  repositories: string[] | undefined
) {
  if (visibility === "selected") {
    // prettier-ignore
    await dry$`gh secret set -o ${organization} -a ${app} -f ${secretsEnvFile} -v ${visibility} -r ${repositories!.toString()}`
  } else {
    // prettier-ignore
    await dry$`gh secret set -o ${organization} -a ${app} -f ${secretsEnvFile} -v ${visibility}`
  }
}

async function setOrganizationVariables(
  organization: string,
  variablesEnvFile: string,
  app: "actions" | "dependabot",
  visibility: "private" | "all" | "selected",
  repositories: string[] | undefined
) {
  if (visibility === "selected") {
    // prettier-ignore
    await dry$`gh variable set -o ${organization} -a ${app} -f ${variablesEnvFile} -v ${visibility} -r ${repositories!.toString()}`
  } else {
    // prettier-ignore
    await dry$`gh variable set -o ${organization} -a ${app} -f ${variablesEnvFile} -v ${visibility}`
  }
}

async function setUserSecrets(
  user: string,
  secretsEnvFile: string,
  app: "codespaces"
) {
  await dry$`gh secret set -u ${user} -a ${app} -f ${secretsEnvFile}`;
}

async function setRepositorySecrets(
  repository: string,
  secretsEnvFile: string,
  app: "actions" | "dependabot" | "codespaces",
  environment: string | undefined
) {
  if (environment) {
    await dry$`gh secret set -R ${repository} -a ${app} -e ${environment} -f ${secretsEnvFile}`;
  } else {
    await dry$`gh secret set -R ${repository} -a ${app} -f ${secretsEnvFile}`;
  }
}

async function setRepositoryVariables(
  repository: string,
  variablesEnvFile: string,
  app: "actions" | "dependabot",
  environment: string | undefined
) {
  if (environment) {
    await dry$`gh variable set -R ${repository} -a ${app} -e ${environment} -f ${variablesEnvFile}`;
  } else {
    await dry$`gh variable set -R ${repository} -a ${app} -f ${variablesEnvFile}`;
  }
}

core.startGroup("process.env");
console.table(process.env);
core.endGroup();

process.env.GH_TOKEN = core.getInput("token");
process.env.GH_HOST = new URL(core.getInput("github_server_url")).host;

const secretsEnvFile = await temporaryWrite(
  core.getInput("secrets") || core.getInput("secret")
);
const variablesEnvFile = await temporaryWrite(
  core.getInput("variables") || core.getInput("variable")
);
const repositories = await getRepositories();

if (core.getInput("mode") === "set") {
  if (core.getInput("organization")) {
    await setOrganizationSecrets(
      core.getInput("organization"),
      secretsEnvFile,
      core.getInput("app") as "actions" | "dependabot" | "codespaces",
      core.getInput("visibility") as "private" | "all" | "selected",
      repositories
    );

    await setOrganizationVariables(
      core.getInput("organization"),
      variablesEnvFile,
      core.getInput("app") as "actions" | "dependabot",
      core.getInput("visibility") as "private" | "all" | "selected",
      repositories
    );
  } else if (core.getInput("user")) {
    await setUserSecrets(
      core.getInput("user"),
      secretsEnvFile,
      core.getInput("app") as "codespaces"
    );
  } else {
    for (const repository of repositories!) {
      await setRepositorySecrets(
        repository,
        secretsEnvFile,
        core.getInput("app") as "actions" | "dependabot" | "codespaces",
        core.getInput("environment")
      );

      await setRepositoryVariables(
        repository,
        variablesEnvFile,
        core.getInput("app") as "actions" | "dependabot",
        core.getInput("environment")
      );
    }
  }
} else if (core.getInput("mode") === "delete") {
} else {
  throw new DOMException("Unknown mode", "NotSupportedError");
}
