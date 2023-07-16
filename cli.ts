#!/usr/bin/env -S deno run -Aq
import process from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert";
import * as core from "npm:@actions/core@^1.10.0";
import { $ } from "npm:zx@^7.2.2";
import { temporaryWrite } from "npm:tempy@^3.1.0";

core.startGroup("process.env");
console.table(process.env);
core.endGroup();

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
    throw new DOMException(
      "Must provide repositories, repository, or query",
      "NotSupportedError"
    );
  }
}

process.env.GH_TOKEN = core.getInput("token");
process.env.GH_HOST = new URL(core.getInput("github_server_url")).host;

if (["set-secret", "set-secrets"].includes(core.getInput("mode"))) {
  let envText: string;
  if (core.getInput("secrets")) {
    envText = core.getInput("secrets");
  } else if (core.getInput("secret")) {
    envText = core.getInput("secret");
  } else {
    throw new DOMException(
      "Must provide secrets or secret",
      "NotSupportedError"
    );
  }
  const envPath = temporaryWrite(envText);

  if (core.getInput("organization")) {
    if (core.getInput("visibility") === "selected") {
      const organization = core.getInput("organization");
      const app = core.getInput("app");
      const repositories = await getRepositories();
      if (core.getBooleanInput("dry_run")) {
        // prettier-ignore
        console.log(`gh secret set -o ${organization} -a ${app} -f ${envPath} -r ${repositories.toString()}`)
      } else {
        // prettier-ignore
        await $`gh secret set -o ${organization} -a ${app} -f ${envPath} -r ${repositories.toString()}`
      }
    } else {
      const organization = core.getInput("organization");
      const app = core.getInput("app");
      if (core.getBooleanInput("dry_run")) {
        console.log(`gh secret set -o ${organization} -a ${app} -f ${envPath}`);
      } else {
        await $`gh secret set -o ${organization} -a ${app} -f ${envPath}`;
      }
    }
  } else if (core.getInput("user")) {
    const user = core.getInput("user");
    const app = core.getInput("app");
    await $`gh secret set -u ${user} -a ${app} -f ${envPath}`;
  } else {
    const app = core.getInput("app");
    for (const repository of await getRepositories()) {
      if (core.getBooleanInput("dry_run")) {
        console.log(`gh secret set -R ${repository} -a ${app} -f ${envPath}`);
      } else {
        await $`gh secret set -R ${repository} -a ${app} -f ${envPath}`;
      }
    }
  }
}
//
else if (["delete-secret", "delete-secrets"].includes(core.getInput("mode"))) {
  if (core.getInput("organization")) {
    const organization = core.getInput("organization");
    const app = core.getInput("app");
    if (core.getBooleanInput("dry_run")) {
      console.log(`gh secret delete -o ${organization} -a ${app}`);
    } else {
      await $`gh secret delete -o ${organization} -a ${app}`;
    }
  } else if (core.getInput("user")) {
    const user = core.getInput("user");
    const app = core.getInput("app");
    if (core.getBooleanInput("dry_run")) {
      console.log(`gh secret delete -u ${user} -a ${app}`);
    } else {
      await $`gh secret delete -u ${user} -a ${app}`;
    }
  } else {
    const app = core.getInput("app");
    for (const repository of await getRepositories()) {
      if (core.getBooleanInput("dry_run")) {
        console.log(`gh secret delete -R ${repository} -a ${app}`);
      } else {
        await $`gh secret delete -R ${repository} -a ${app}`;
      }
    }
  }
} else {
  throw new DOMException("Unknown mode", "NotSupportedError");
}
