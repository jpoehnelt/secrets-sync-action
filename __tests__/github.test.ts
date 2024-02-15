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

  jest.setTimeout(5000);

  const variables = { FOO: "BAR" };

  let createVariableMock: nock.Scope;
  let updateVariableMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();

    createVariableMock = nock("https://api.github.com")
    .post(
      `/repos/${repo.owner}/${repo.name}/actions/variables/${Object.keys(variables)[0]}`,
      (body) => {
        expect(body.name).toBe(Object.keys(variables)[0]);
        expect(body.value).toBe(Object.values(variables)[0]);
        return body;
      }
    )
    .reply(200);

    updateVariableMock = nock("https://api.github.com")
    .patch(
      `/repos/${repo.owner}/${repo.name}/actions/variables/${Object.keys(variables)[0]}`,
      (body) => {
          expect(body.name).toBe(Object.keys(variables)[0]);
          expect(body.value).toBe(Object.values(variables)[0]);
        return body;
      }
    )
    .reply(200);
  });

  test("setVariableForRepo should not set variable with dry run", async () => {
    await setVariableForRepo(
      octokit,
      Object.keys(variables)[0],
      Object.values(variables)[0],
      repo,
      "",
      true
    );

    expect(createVariableMock.isDone()).toBeFalsy();
    expect(updateVariableMock.isDone()).toBeFalsy();
  });

  test("setVariableForRepo should call update variable endpoint", async () => {
    nock("https://api.github.com")
    .get(`/repos/${repo.owner}/${repo.name}/actions/variables/${Object.keys(variables)[0]}`)
    .reply(200);

    await setVariableForRepo(
      octokit,
      Object.keys(variables)[0],
      Object.values(variables)[0],
      repo,
      "",
      false
    );

    expect(createVariableMock.isDone()).toBeFalsy();
    expect(updateVariableMock.isDone()).toBeTruthy();
  });

  test("setVariableForRepo should call create variable endpoint", async () => {
    nock("https://api.github.com")
    .get(`/repos/${repo.owner}/${repo.name}/actions/variables/${Object.keys(variables)[0]}`)
    .reply(404);

    await setVariableForRepo(
      octokit,
      Object.keys(variables)[0],
      Object.values(variables)[0],
      repo,
      "",
      false
    );

    expect(createVariableMock.isDone()).toBeTruthy();
    expect(updateVariableMock.isDone()).toBeFalsy();
  });
});

describe("setVariableForRepo with environment", () => {
  const repo = fixture[0].response;

  jest.setTimeout(5000);

  const variables = { FOO: "BAR" };

  const repoEnvironment = "production";

  let createEnvironmentVariableMock: nock.Scope;
  let updateEnvironmentVariableMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();

    createEnvironmentVariableMock = nock("https://api.github.com")
      .post(
        `/repositories/${repo.id}/environments/${repoEnvironment}/variables/${Object.keys(variables)[0]}`,
        (body) => {
          expect(body.name).toBe(Object.keys(variables)[0]);
          expect(body.value).toBe(Object.values(variables)[0]);
          return body;
        }
      )
      .reply(200);

      updateEnvironmentVariableMock = nock("https://api.github.com")
      .patch(
        `/repositories/${repo.id}/environments/${repoEnvironment}/variables/${Object.keys(variables)[0]}`,
        (body) => {
            expect(body.name).toBe(Object.keys(variables)[0]);
            expect(body.value).toBe(Object.values(variables)[0]);
          return body;
        }
      )
      .reply(200);
  });

  test("setVariableForRepo should not set variable with dry run", async () => {
    await setVariableForRepo(
      octokit,
      "FOO",
      variables.FOO,
      repo,
      repoEnvironment,
      true
    );

    expect(createEnvironmentVariableMock.isDone()).toBeFalsy();
    expect(updateEnvironmentVariableMock.isDone()).toBeFalsy();
  });

  test("setVariableForRepo should call create variable endpoint", async () => {
    nock("https://api.github.com")
    .get(`/repositories/${repo.id}/environments/${repoEnvironment}/variables/${Object.keys(variables)[0]}`)
    .reply(404);

    await setVariableForRepo(
      octokit,
      "FOO",
      variables.FOO,
      repo,
      repoEnvironment,
      false
    );

    expect(createEnvironmentVariableMock.isDone()).toBeTruthy();
    expect(updateEnvironmentVariableMock.isDone()).toBeFalsy();
  });

  test("setVariableForRepo should call update variable endpoint", async () => {
    nock("https://api.github.com")
    .get(`/repositories/${repo.id}/environments/${repoEnvironment}/variables/${Object.keys(variables)[0]}`)
    .reply(200);

    await setVariableForRepo(
      octokit,
      "FOO",
      variables.FOO,
      repo,
      repoEnvironment,
      false
    );

    expect(createEnvironmentVariableMock.isDone()).toBeFalsy();
    expect(updateEnvironmentVariableMock.isDone()).toBeTruthy();
  });
});

describe("deleteVariableForRepo", () => {
  const repo = fixture[0].response;

  jest.setTimeout(5000);

  const secrets = { FOO: "BAR" };
  let deleteActionsVariableMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();

    deleteActionsVariableMock = nock("https://api.github.com")
      .delete(`/repos/${repo.full_name}/actions/variables/FOO`)
      .reply(200);
  });

  test("deleteVariableForRepo should not delete variable with dry run", async () => {
    await deleteVariableForRepo(
      octokit,
      "FOO",
      repo,
      "",
      true
    );
    expect(deleteActionsVariableMock.isDone()).toBeFalsy();
  });

  test("deleteVariableForRepo with should call delete variable endpoint", async () => {
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

  jest.setTimeout(5000);

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

  test("deleteVariableForRepo should not delete variable with dry run", async () => {
    await deleteVariableForRepo(
      octokit,
      "FOO",
      repo,
      repoEnvironment,
      true
    );
    expect(deleteVariableMock.isDone()).toBeFalsy();
  });

  test("deleteVariableForRepo should call delete variable endpoint", async () => {
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
