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
import { retry } from "@octokit/plugin-retry";

const RetryOctokit = Octokit.plugin(retry);

/* istanbul ignore next */
function onRateLimit(retryAfter: any, options: any): boolean {
  core.warning(
    `Request quota exhausted for request ${options.method} ${options.url}`
  );

  if (options.request.retryCount === 0) {
    core.warning(`Retrying after ${retryAfter} seconds!`);
    return true;
  }
  return false;
}

/* istanbul ignore next */
function onAbuseLimit(_: any, options: any): void {
  core.warning(`Abuse detected for request ${options.method} ${options.url}`);
}

const defaultOptions = {
  throttle: {
    onRateLimit,
    onAbuseLimit
  }
};

// eslint-disable-next-line @typescript-eslint/promise-function-async
export function DefaultOctokit({ ...options }): any {
  return new RetryOctokit({ ...defaultOptions, ...options });
}

export async function listAllMatchingRepos({
  patterns,
  octokit,
  affiliation = "owner,collaborator,organization_member",
  per_page = 30
}: {
  patterns: string[];
  octokit: any;
  affiliation?: string;
  per_page?: number;
}): Promise<any[]> {
  const repos = await listAllReposForAuthenticatedUser({
    octokit,
    affiliation,
    per_page
  });

  core.info(
    `Available repositories: ${JSON.stringify(repos.map(r => r.full_name))}`
  );

  return filterReposByPatterns(repos, patterns);
}

export async function listAllReposForAuthenticatedUser({
  octokit,
  affiliation,
  per_page
}: {
  octokit: any;
  affiliation: string;
  per_page: number;
}): Promise<any[]> {
  const repos: any[] = [];

  for (let i = 1; i < 10; i++) {
    const response = await octokit.repos.listForAuthenticatedUser({
      affiliation,
      page: i,
      pageSize: per_page
    });
    repos.push(...response.data);

    if (response.data.length < per_page) {
      break;
    }
  }
  return repos;
}

export function filterReposByPatterns(repos: any[], patterns: string[]): any[] {
  const regexPatterns = patterns.map(s => new RegExp(s));

  return repos.filter(
    repo => regexPatterns.filter(r => r.test(repo.full_name)).length
  );
}

export async function setSecretsForRepo(
  octokit: any,
  secrets: { [key: string]: string },
  repo: any,
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
