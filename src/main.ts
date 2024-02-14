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
  Repository,
  listAllMatchingRepos,
  setVariableForRepo,
  deleteVariableForRepo,
  getRepos,
} from "./github";

import { getConfig } from "./config";
import { getVariables } from "./variables";
import pLimit from "p-limit";

export async function run(): Promise<void> {
  try {
    const config = getConfig();
    const variables = getVariables(config.VARIABLES);

    /* istanbul ignore next */
    if (!variables) {
      core.setFailed(
        `Variables: no matches with "${config.VARIABLES.join(", ")}"`
      );
      return;
    }

    const octokit = DefaultOctokit({
      auth: config.GITHUB_TOKEN,
      baseUrl: config.GITHUB_API_URL,
    });

    let repos: Repository[];
    if (config.REPOSITORIES_LIST_REGEX) {
      repos = await listAllMatchingRepos({
        patterns: config.REPOSITORIES,
        octokit,
      });
    } else {
      repos = await getRepos({
        patterns: config.REPOSITORIES,
        octokit,
      });
    }

    /* istanbul ignore next */
    if (repos.length === 0) {
      const repoPatternString = config.REPOSITORIES.join(", ");
      core.setFailed(
        `Repos: No matches with "${repoPatternString}". Check your token and regex.`
      );
      return;
    }

    const repoNames = repos.map((r) => r.full_name);

    core.info(
      JSON.stringify(
        {
          REPOSITORIES: config.REPOSITORIES,
          REPOSITORIES_LIST_REGEX: config.REPOSITORIES_LIST_REGEX,
          VARIABLES: config.VARIABLES,
          DRY_RUN: config.DRY_RUN,
          FOUND_REPOS: repoNames,
          FOUND_VARIABLES: Object.keys(variables),
          ENVIRONMENT: config.ENVIRONMENT,
        },
        null,
        2
      )
    );

    const limit = pLimit(config.CONCURRENCY);
    const calls: Promise<void>[] = [];
    for (const repo of repos) {
      for (const k of Object.keys(variables)) {
        if (config.RUN_DELETE) {
          calls.push(
            limit(() =>
              deleteVariableForRepo(
                octokit,
                k,
                repo,
                config.ENVIRONMENT,
                config.DRY_RUN
              )
            )
          );
        } else {
          calls.push(
            limit(() =>
              setVariableForRepo(
                octokit,
                k,
                variables[k],
                repo,
                config.ENVIRONMENT,
                config.DRY_RUN
              )
            )
          );
        }
      }
    }
    await Promise.all(calls);
  } catch (error: any) {
    /* istanbul ignore next */
    core.error(error);
    /* istanbul ignore next */
    core.setFailed(error.message);
  }
}
