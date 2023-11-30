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

import * as config from "../src/config";

import {
  DefaultOctokit,
  filterReposByPatterns,
  listAllMatchingRepos,
  getRepos,
  publicKeyCache,
  setSecretForRepo,
  deleteSecretForRepo,
} from "../src/github";

// @ts-ignore-next-line
import fixture from "@octokit/fixtures/scenarios/api.github.com/get-repository/normalized-fixture.json";
import nock from "nock";

let octokit: any;

beforeAll(() => {
  nock.disableNetConnect();
  (config.getConfig as jest.Mock) = jest.fn().mockReturnValue({
    GITHUB_TOKEN: "token",
    SECRETS: ["BAZ"],
    REPOSITORIES: [".*"],
    REPOSITORIES_LIST_REGEX: true,
    DRY_RUN: false,
    RETRIES: 3,
  });

  octokit = DefaultOctokit({
    auth: "",
  });
});

afterAll(() => {
  nock.enableNetConnect();
});

describe("listing repos from github", () => {
  const pageSize = 3;
  beforeEach(() => {
    nock("https://api.github.com")
      .get(/\/user\/repos?.*page=1.*/)
      .reply(200, [
        fixture[0].response,
        fixture[0].response,
        { archived: true, full_name: "foo/bar" },
      ]);

    nock("https://api.github.com")
      .get(/\/user\/repos?.*page=2.*/)
      .reply(200, [fixture[0].response]);
  });

  test("listAllReposForAuthenticatedUser returns from multiple pages", async () => {
    const repos = await listAllMatchingRepos({
      patterns: [".*"],
      octokit,
      pageSize,
    });

    expect(repos.length).toEqual(3);
  });

  test("listAllReposForAuthenticatedUser matches patterns", async () => {
    const repos = await listAllMatchingRepos({
      patterns: ["octokit.*"],
      octokit,
      pageSize,
    });

    expect(repos.length).toEqual(3);
  });
});

describe("getting single repos from github", () => {
  nock.cleanAll();

  const repo = fixture[0].response;

  beforeEach(() => {
    nock("https://api.github.com")
      .persist()
      .get(`/repos/${repo.full_name}`)
      .reply(fixture[0].status, fixture[0].response);
  });

  test("getRepos returns from multiple pages", async () => {
    const repos = await getRepos({
      patterns: [
        fixture[0].response.full_name,
        fixture[0].response.full_name,
        fixture[0].response.full_name,
      ],
      octokit,
    });

    expect(repos.length).toEqual(3);
  });
});

test("filterReposByPatterns matches patterns", async () => {
  expect(filterReposByPatterns([fixture[0].response], [".*"]).length).toBe(1);
  expect(filterReposByPatterns([fixture[0].response], ["nope"]).length).toBe(0);
});

describe("setSecretForRepo", () => {
  const repo = fixture[0].response;
  const publicKey = {
    key_id: "1234",
    key: "HRkzRZD1+duhfvNvY8eiCPb+ihIjbvkvRyiehJCs8Vc=",
  };

  jest.setTimeout(30000);

  const secrets = { FOO: "BAR" };

  const repoEnvironment = "production";

  let publicKeyMock: nock.Scope;
  let setSecretMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();
    publicKeyCache.clear();
    publicKeyMock = nock("https://api.github.com")
      .get(`/repos/${repo.full_name}/actions/secrets/public-key`)
      .reply(200, publicKey);

    setSecretMock = nock("https://api.github.com")
      .put(`/repos/${repo.full_name}/actions/secrets/FOO`, (body) => {
        expect(body.encrypted_value).toBeTruthy();
        expect(body.key_id).toEqual(publicKey.key_id);
        return body;
      })
      .reply(200);
  });

  test("setSecretForRepo should retrieve public key", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      true,
      "actions"
    );
    expect(publicKeyMock.isDone()).toBeTruthy();
  });

  test("setSecretForRepo should not set secret with dry run", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      true,
      "actions"
    );
    expect(publicKeyMock.isDone()).toBeTruthy();
    expect(setSecretMock.isDone()).toBeFalsy();
  });

  test("setSecretForRepo should call set secret endpoint", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      false,
      "actions"
    );
    expect(nock.isDone()).toBeTruthy();
  });
});

describe("setSecretForRepo with environment", () => {
  const repo = fixture[0].response;
  const publicKey = {
    key_id: "1234",
    key: "HRkzRZD1+duhfvNvY8eiCPb+ihIjbvkvRyiehJCs8Vc=",
  };

  jest.setTimeout(30000);

  const secrets = { FOO: "BAR" };

  const repoEnvironment = "production";

  let environmentPublicKeyMock: nock.Scope;
  let setEnvironmentSecretMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();
    publicKeyCache.clear();

    environmentPublicKeyMock = nock("https://api.github.com")
      .get(
        `/repositories/${repo.id}/environments/${repoEnvironment}/secrets/public-key`
      )
      .reply(200, publicKey);

    setEnvironmentSecretMock = nock("https://api.github.com")
      .put(
        `/repositories/${repo.id}/environments/${repoEnvironment}/secrets/FOO`,
        (body) => {
          expect(body.encrypted_value).toBeTruthy();
          expect(body.key_id).toEqual(publicKey.key_id);
          return body;
        }
      )
      .reply(200);
  });

  test("setSecretForRepo should retrieve public key", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      true,
      "actions"
    );
    expect(environmentPublicKeyMock.isDone()).toBeTruthy();
  });

  test("setSecretForRepo should not set secret with dry run", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      true,
      "actions"
    );
    expect(environmentPublicKeyMock.isDone()).toBeTruthy();
    expect(setEnvironmentSecretMock.isDone()).toBeFalsy();
  });

  test("setSecretForRepo should call set secret endpoint", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      false,
      "actions"
    );
    expect(nock.isDone()).toBeTruthy();
  });
});

describe("deleteSecretForRepo", () => {
  const repo = fixture[0].response;

  jest.setTimeout(30000);

  const secrets = { FOO: "BAR" };
  let deleteSecretMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();
    deleteSecretMock = nock("https://api.github.com")
      .delete(`/repos/${repo.full_name}/actions/secrets/FOO`)
      .reply(200);
  });

  test("deleteSecretForRepo should not delete secret with dry run", async () => {
    await deleteSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      true,
      "actions"
    );
    expect(deleteSecretMock.isDone()).toBeFalsy();
  });

  test("deleteSecretForRepo should call set secret endpoint", async () => {
    await deleteSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      false,
      "actions"
    );
    expect(nock.isDone()).toBeTruthy();
  });
});

describe("deleteSecretForRepo with environment", () => {
  const repo = fixture[0].response;

  const repoEnvironment = "production";

  jest.setTimeout(30000);

  const secrets = { FOO: "BAR" };
  let deleteSecretMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();
    deleteSecretMock = nock("https://api.github.com")
      .delete(
        `/repositories/${repo.id}/environments/${repoEnvironment}/secrets/FOO`
      )
      .reply(200);
  });

  test("deleteSecretForRepo should not delete secret with dry run", async () => {
    await deleteSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      true,
      "actions"
    );
    expect(deleteSecretMock.isDone()).toBeFalsy();
  });

  test("deleteSecretForRepo should call set secret endpoint", async () => {
    await deleteSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      false,
      "actions"
    );
    expect(nock.isDone()).toBeTruthy();
  });
});
