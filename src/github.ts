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

import { Octokit } from "@octokit/rest";
import { encrypt } from "./utils";
import { getConfig } from "./config";
import { retry } from "@octokit/plugin-retry";

export interface Repository {
  full_name: string;
}

const RetryOctokit = Octokit.plugin(retry);

export function DefaultOctokit({ ...options }): any {
  const retries = getConfig().RETRIES;

  /* istanbul ignore next */
  function onRateLimit(retryAfter: any, options: any): boolean {
    core.warning(
      `Request quota exhausted for request ${options.method} ${options.url}`
    );

    if (options.request.retryCount < retries) {
      core.warning(`Retrying after ${retryAfter} seconds!`);
      return true;
    }
    return false;
  }

  /* istanbul ignore next */
  function onAbuseLimit(retryAfter: any, options: any): boolean {
    core.warning(`Abuse detected for request ${options.method} ${options.url}`);

    if (options.request.retryCount < retries) {
      core.warning(`Retrying after ${retryAfter} seconds!`);
      return true;
    }
    return false;
  }

  const defaultOptions = {
    throttle: {
      onRateLimit,
      onAbuseLimit
    }
  };

  return new RetryOctokit({ ...defaultOptions, ...options });
}

export async function listAllMatchingRepos({
  patterns,
  octokit,
  affiliation = "owner,collaborator,organization_member",
  pageSize = 30
}: {
  patterns: string[];
  octokit: any;
  affiliation?: string;
  pageSize?: number;
}): Promise<Repository[]> {
  const repos = await listAllReposForAuthenticatedUser({
    octokit,
    affiliation,
    pageSize
  });

  core.info(
    `Available repositories: ${JSON.stringify(repos.map(r => r.full_name))}`
  );

  return filterReposByPatterns(repos, patterns);
}

export async function listAllReposForAuthenticatedUser({
  octokit,
  affiliation,
  pageSize
}: {
  octokit: any;
  affiliation: string;
  pageSize: number;
}): Promise<Repository[]> {
  const repos: Repository[] = [];

  for (let page = 1; ; page++) {
    const response = await octokit.repos.listForAuthenticatedUser({
      affiliation,
      page,
      pageSize
    });
    repos.push(...response.data);

    if (response.data.length < pageSize) {
      break;
    }
  }
  return repos;
}

export function filterReposByPatterns(
  repos: Repository[],
  patterns: string[]
): Repository[] {
  const regexPatterns = patterns.map(s => new RegExp(s));

  return repos.filter(
    repo => regexPatterns.filter(r => r.test(repo.full_name)).length
  );
}

export async function setSecretsForRepo(
  octokit: any,
  secrets: { [key: string]: string },
  repo: Repository,
  dry_run: boolean
): Promise<void> {
  const [owner, name] = repo.full_name.split("/");

  const publicKey = (
    await octokit.actions.getPublicKey({
      owner,
      repo: name
    })
  ).data;

  for (const k of Object.keys(secrets)) {
    const encrypted_value = encrypt(secrets[k], publicKey.key);

    core.info(`Set \`${k} = ***\` on ${repo.full_name}`);

    if (!dry_run) {
      await octokit.actions.createOrUpdateSecretForRepo({
        owner,
        repo: name,
        name: k,
        key_id: publicKey.key_id,
        encrypted_value
      });
    }
  }
}
