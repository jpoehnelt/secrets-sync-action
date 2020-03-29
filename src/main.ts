/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as core from "@actions/core";

import {
  DefaultOctokit,
  listAllMatchingRepos,
  setSecretsForRepo
} from "./github";

import { getConfig } from "./config";
import { getSecrets } from "./secrets";

export async function run(): Promise<void> {
  try {
    const config = getConfig();
    const secrets = getSecrets(config.SECRETS);

    /* istanbul ignore next */
    if (!secrets) {
      core.setFailed(`Secrets: no matches with "${config.SECRETS.join(", ")}"`);
      return;
    }

    const octokit = DefaultOctokit({
      auth: config.GITHUB_TOKEN
    });

    const repos = await listAllMatchingRepos({
      patterns: config.REPOSITORIES,
      octokit
    });

    /* istanbul ignore next */
    if (repos.length === 0) {
      const repoPatternString = config.REPOSITORIES.join(", ");
      core.setFailed(
        `Repos: No matches with "${repoPatternString}". Check your token and regex.`
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const repoNames = repos.map(r => r.full_name);

    core.info(
      JSON.stringify(
        {
          REPOSITORIES: config.REPOSITORIES,
          SECRETS: config.SECRETS,
          DRY_RUN: config.DRY_RUN,
          FOUND_REPOS: repoNames,
          FOUND_SECRETS: Object.keys(secrets)
        },
        null,
        2
      )
    );

    await Promise.all(
      repos.map(async repo =>
        setSecretsForRepo(octokit, secrets, repo, config.DRY_RUN)
      )
    );
  } catch (error) {
      core.error(error);
      core.setFailed(error.message);
  }
}

run();
