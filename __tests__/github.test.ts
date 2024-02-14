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
  setVariableForRepo,
  deleteVariableForRepo,
} from "../src/github";

// @ts-ignore-next-line
import fixture from "@octokit/fixtures/scenarios/api.github.com/get-repository/normalized-fixture.json";
import nock from "nock";

let octokit: any;

beforeAll(() => {
  nock.disableNetConnect();
  (config.getConfig as jest.Mock) = jest.fn().mockReturnValue({
    GITHUB_TOKEN: "token",
    VARIABLES: ["BAZ"],
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

describe("setVariableForRepo", () => {
  const repo = fixture[0].response;
  const publicKey = {
    key_id: "1234",
    key: "HRkzRZD1+duhfvNvY8eiCPb+ihIjbvkvRyiehJCs8Vc=",
  };

  jest.setTimeout(30000);

  const variables = { FOO: "BAR" };

  const repoEnvironment = "production";

  let setActionsVariableMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();

    setActionsVariableMock = nock("https://api.github.com")
      .put(`/repos/${repo.full_name}/actions/variables`, (body) => {

        expect(body.name).toBe("FOO")
        expect(body.value).toBe(variables.FOO);
        return body;
      })
      .reply(200);
  });

  test("setVariableForRepo should not set variable with dry run", async () => {
    await setVariableForRepo(
      octokit,
      "FOO",
      variables.FOO,
      repo,
      "",
      true
    );

    expect(setActionsVariableMock.isDone()).toBeFalsy();
  });

  test("setVariableForRepo should call set variable endpoint for Actions", async () => {
    await setVariableForRepo(
      octokit,
      "FOO",
      variables.FOO,
      repo,
      "",
      false
    );

    expect(setActionsVariableMock.isDone()).toBeTruthy();
  });
});

describe("setVariableForRepo with environment", () => {
  const repo = fixture[0].response;
  const publicKey = {
    key_id: "1234",
    key: "HRkzRZD1+duhfvNvY8eiCPb+ihIjbvkvRyiehJCs8Vc=",
  };

  jest.setTimeout(30000);

  const secrets = { FOO: "BAR" };

  const repoEnvironment = "production";

  let environmentPublicKeyMock: nock.Scope;
  let setEnvironmentVariableMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();
    publicKeyCache.clear();

    environmentPublicKeyMock = nock("https://api.github.com")
      .get(
        `/repositories/${repo.id}/environments/${repoEnvironment}/secrets/public-key`
      )
      .reply(200, publicKey);

    setEnvironmentVariableMock = nock("https://api.github.com")
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

  test("setVariableForRepo should not set secret with dry run", async () => {
    await setVariableForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      true
    );

    expect(setEnvironmentVariableMock.isDone()).toBeFalsy();
  });

  test("setVariableForRepo should call set secret endpoint", async () => {
    await setVariableForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      false
    );
    expect(nock.isDone()).toBeTruthy();
  });
});

describe("deleteVariableForRepo", () => {
  const repo = fixture[0].response;

  jest.setTimeout(30000);

  const secrets = { FOO: "BAR" };
  let deleteActionsVariableMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();

    deleteActionsVariableMock = nock("https://api.github.com")
      .delete(`/repos/${repo.full_name}/actions/secrets/FOO`)
      .reply(200);
  });

  test("deleteVariableForRepo should not delete secret with dry run", async () => {
    await deleteVariableForRepo(
      octokit,
      "FOO",
      repo,
      "",
      true
    );
    expect(deleteActionsVariableMock.isDone()).toBeFalsy();
  });

  test("deleteVariableForRepo with Actions target should call set secret endpoint for Actions", async () => {
    await deleteVariableForRepo(
      octokit,
      "FOO",
      repo,
      "",
      false
    );
    expect(deleteActionsVariableMock.isDone()).toBeTruthy();
  });
});

describe("deleteVariableForRepo with environment", () => {
  const repo = fixture[0].response;

  const repoEnvironment = "production";

  jest.setTimeout(30000);

  const secrets = { FOO: "BAR" };
  let deleteVariableMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();
    deleteVariableMock = nock("https://api.github.com")
      .delete(
        `/repositories/${repo.id}/environments/${repoEnvironment}/variables/FOO`
      )
      .reply(200);
  });

  test("deleteVariableForRepo should not delete secret with dry run", async () => {
    await deleteVariableForRepo(
      octokit,
      "FOO",
      repo,
      repoEnvironment,
      true
    );
    expect(deleteVariableMock.isDone()).toBeFalsy();
  });

  test("deleteVariableForRepo with Actions target should call set secret endpoint for Actions", async () => {
    await deleteVariableForRepo(
      octokit,
      "FOO",
      repo,
      repoEnvironment,
      false
    );
    expect(nock.isDone()).toBeTruthy();
  });
});
