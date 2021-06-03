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
  archived?: boolean;
}

export interface PublicKey {
  key: string;
  key_id: string;
}

export const publicKeyCache = new Map<Repository, PublicKey>();

const RetryOctokit = Octokit.plugin(retry);

export function DefaultOctokit({ ...octokitOptions }): any {
  const retries = getConfig().RETRIES;

  /* istanbul ignore next */
  function onRateLimit(retryAfter: any, options: any): boolean {
    core.warning(
      `Request quota exhausted for request ${options.method} ${options.url}`
    );

    if (options.request.retryCount < retries) {
      core.warning(
        `Retrying request ${options.method} ${options.url} after ${retryAfter} seconds!`
      );
      return true;
    }
    core.warning(`Did not retry request ${options.method} ${options.url}`);
    return false;
  }

  /* istanbul ignore next */
  function onAbuseLimit(retryAfter: any, options: any): boolean {
    core.warning(`Abuse detected for request ${options.method} ${options.url}`);

    if (options.request.retryCount < retries) {
      core.warning(
        `Retrying request ${options.method} ${options.url} after ${retryAfter} seconds!`
      );
      return true;
    }
    core.warning(`Did not retry request ${options.method} ${options.url}`);
    return false;
  }

  const defaultOptions = {
    throttle: {
      onRateLimit,
      onAbuseLimit
    }
  };

  return new RetryOctokit({ ...defaultOptions, ...octokitOptions });
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
  return repos.filter(r => !r.archived);
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

export async function getPublicKey(
  octokit: any,
  repo: Repository
): Promise<PublicKey> {
  let publicKey = publicKeyCache.get(repo);

  if (!publicKey) {
    const [owner, name] = repo.full_name.split("/");
    publicKey = (
      await octokit.actions.getPublicKey({
        owner,
        repo: name
      })
    ).data as PublicKey;

    publicKeyCache.set(repo, publicKey);
  }

  return publicKey;
}

export async function setSecretForRepo(
  octokit: any,
  name: string,
  secret: string,
  repo: Repository,
  dry_run: boolean
): Promise<void> {
  const [repo_owner, repo_name] = repo.full_name.split("/");

  const publicKey = await getPublicKey(octokit, repo);
  const encrypted_value = encrypt(secret, publicKey.key);

  core.info(`Set \`${name} = ***\` on ${repo.full_name}`);

  if (!dry_run) {
    return octokit.actions.createOrUpdateSecretForRepo({
      owner: repo_owner,
      repo: repo_name,
      name,
      key_id: publicKey.key_id,
      encrypted_value
    });
  }
}

export async function deleteSecretForRepo(
  octokit: any,
  name: string,
  secret: string,
  repo: Repository,
  dry_run: boolean
): Promise<void> {
  core.info(`Remove ${name} from ${repo.full_name}`);

  try {
    if (!dry_run) {
      const action = "DELETE";
      const request = `/repos/${repo.full_name}/actions/secrets/${name}`;
      return octokit.request(`${action} ${request}`);
    }
  } catch (HttpError) {
    //If secret is not found in target repo, silently continue
  }
}
