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

import {
  DefaultOctokit,
  filterReposByPatterns,
  listAllMatchingRepos,
  setSecretsForRepo
} from "../src/github";

// @ts-ignore-next-line
import fixture from "@octokit/fixtures/scenarios/api.github.com/get-repository/normalized-fixture.json";
import nock from "nock";

const octokit = DefaultOctokit({
  auth: ""
});

beforeAll(() => {
  nock.disableNetConnect();
});

afterAll(() => {
  nock.enableNetConnect();
});

describe("listing repos from github", () => {
  const pageSize = 2;
  beforeEach(() => {
    nock("https://api.github.com")
      .get(/\/user\/repos?.*page=1.*/)
      .reply(200, [fixture[0].response, fixture[0].response]);

    nock("https://api.github.com")
      .get(/\/user\/repos?.*page=2.*/)
      .reply(200, [fixture[0].response]);
  });

  test("listAllReposForAuthenticatedUser returns from multiple pages", async () => {
    const repos = await listAllMatchingRepos({
      patterns: [".*"],
      octokit,
      pageSize
    });

    expect(repos.length).toEqual(3);
  });

  test("listAllReposForAuthenticatedUser matches patterns", async () => {
    const repos = await listAllMatchingRepos({
      patterns: ["octokit.*"],
      octokit,
      pageSize
    });

    expect(repos.length).toEqual(3);
  });
});

test("filterReposByPatterns matches patterns", async () => {
  expect(filterReposByPatterns([fixture[0].response], [".*"]).length).toBe(1);
  expect(filterReposByPatterns([fixture[0].response], ["nope"]).length).toBe(0);
});

describe("setSecretsForRepo", () => {
  const repo = fixture[0].response;
  const publicKey = {
    key_id: "1234",
    key: "HRkzRZD1+duhfvNvY8eiCPb+ihIjbvkvRyiehJCs8Vc="
  };

  jest.setTimeout(30000);

  const secrets = { FOO: "BAR" };

  let publicKeyMock: nock.Scope;
  let setSecretMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();
    publicKeyMock = nock("https://api.github.com")
      .get(`/repos/${repo.full_name}/actions/secrets/public-key`)
      .reply(200, publicKey);
    setSecretMock = nock("https://api.github.com")
      .put(`/repos/${repo.full_name}/actions/secrets/FOO`, body => {
        expect(body.encrypted_value).toBeTruthy();
        expect(body.key_id).toEqual(publicKey.key_id);
        return body;
      })
      .reply(200);
  });

  test("setSecretsForRepo should retrieve public key", async () => {
    await setSecretsForRepo(octokit, secrets, repo, true);
    expect(publicKeyMock.isDone()).toBeTruthy();
  });

  test("setSecretsForRepo should not set secret with dry run", async () => {
    await setSecretsForRepo(octokit, secrets, repo, true);
    expect(publicKeyMock.isDone()).toBeTruthy();
    expect(setSecretMock.isDone()).toBeFalsy();
  });

  test("setSecretsForRepo should should call set secret endpoint", async () => {
    await setSecretsForRepo(octokit, secrets, repo, false);
    expect(nock.isDone()).toBeTruthy();
  });
});
