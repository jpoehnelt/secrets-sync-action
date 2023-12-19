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
import * as utils from "../src/utils";

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

  let actionsPublicKeyMock: nock.Scope;
  let dependabotPublicKeyMock: nock.Scope;
  let setActionsSecretMock: nock.Scope;
  let setDependabotSecretMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();

    publicKeyCache.clear();

    actionsPublicKeyMock = nock("https://api.github.com")
      .get(`/repos/${repo.full_name}/actions/secrets/public-key`)
      .reply(200, publicKey);

    dependabotPublicKeyMock = nock("https://api.github.com")
      .get(`/repos/${repo.full_name}/dependabot/secrets/public-key`)
      .reply(200, publicKey);

    setActionsSecretMock = nock("https://api.github.com")
      .put(`/repos/${repo.full_name}/actions/secrets/FOO`, (body) => {
        expect(body.encrypted_value).toBeTruthy();
        expect(body.key_id).toEqual(publicKey.key_id);
        return body;
      })
      .reply(200);

    setDependabotSecretMock = nock("https://api.github.com")
      .put(`/repos/${repo.full_name}/dependabot/secrets/FOO`, (body) => {
        expect(body.encrypted_value).toBeTruthy();
        expect(body.key_id).toEqual(publicKey.key_id);
        return body;
      })
      .reply(200);

    (utils.hash as jest.Mock) = jest.fn().mockImplementation(() => "hash");
  });

  test("setSecretForRepo with Actions target should retrieve public key for Actions", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      true,
      "actions",
      "salt"
    );
    expect(actionsPublicKeyMock.isDone()).toBeTruthy();
  });

  test("setSecretForRepo with Dependabot target should retrieve public key for Dependabot", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      true,
      "dependabot",
      "salt"
    );
    expect(dependabotPublicKeyMock.isDone()).toBeTruthy();
  });

  test("setSecretForRepo should not set secret with dry run", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      true,
      "actions",
      "salt"
    );
    expect(actionsPublicKeyMock.isDone()).toBeTruthy();
    expect(setActionsSecretMock.isDone()).toBeFalsy();
  });

  test("setSecretForRepo with Actions target should call set secret endpoint for Actions", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      false,
      "actions",
      "salt"
    );
    expect(setActionsSecretMock.isDone()).toBeTruthy();
  });

  test("setSecretForRepo with Dependabot target should call set secret endpoint for Dependabot", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      false,
      "dependabot",
      "salt"
    );
    expect(setDependabotSecretMock.isDone()).toBeTruthy();
  });

  test("setSecretForRepo should return AuditLog", async () => {
    const secret_name = "FOO";
    const environment = "";
    const dry_run = false;
    const target = "actions";

    const auditLog = await setSecretForRepo(
      octokit,
      secret_name,
      secrets.FOO,
      repo,
      environment,
      dry_run,
      target,
      "salt"
    );
    expect(auditLog.action === "set");
    expect(auditLog.repo === repo.full_name);
    expect(auditLog.dry_run === dry_run);
    expect(auditLog.environment === environment);
    expect(auditLog.target === target);
    expect(auditLog.secret_name == secret_name);
    expect(auditLog.secret_hash != null);
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

    (utils.hash as jest.Mock) = jest.fn().mockImplementation(() => "hash");
  });

  test("setSecretForRepo should retrieve public key", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      true,
      "actions",
      "salt"
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
      "actions",
      "salt"
    );
    expect(environmentPublicKeyMock.isDone()).toBeTruthy();
    expect(setEnvironmentSecretMock.isDone()).toBeFalsy();
  });

  test("setSecretForRepo should not set secret with Dependabot target", async () => {
    await setSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      true,
      "dependabot",
      "salt"
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
      "actions",
      "salt"
    );
    expect(nock.isDone()).toBeTruthy();
  });

  test("setSecretForRepo should return AuditLog", async () => {
    const secret_name = "FOO";
    const dry_run = false;
    const target = "actions";

    const auditLog = await setSecretForRepo(
      octokit,
      secret_name,
      secrets.FOO,
      repo,
      repoEnvironment,
      dry_run,
      target,
      "salt"
    );
    expect(auditLog.action === "set");
    expect(auditLog.repo === repo.full_name);
    expect(auditLog.dry_run === dry_run);
    expect(auditLog.environment === repoEnvironment);
    expect(auditLog.target === target);
    expect(auditLog.secret_name == secret_name);
    expect(auditLog.secret_hash != null);
  });
});

describe("deleteSecretForRepo", () => {
  const repo = fixture[0].response;

  jest.setTimeout(30000);

  const secrets = { FOO: "BAR" };
  let deleteActionsSecretMock: nock.Scope;
  let deleteDependabotSecretMock: nock.Scope;

  beforeEach(() => {
    nock.cleanAll();

    deleteActionsSecretMock = nock("https://api.github.com")
      .delete(`/repos/${repo.full_name}/actions/secrets/FOO`)
      .reply(200);

    deleteDependabotSecretMock = nock("https://api.github.com")
      .delete(`/repos/${repo.full_name}/dependabot/secrets/FOO`)
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
      "actions",
      "salt"
    );
    expect(deleteActionsSecretMock.isDone()).toBeFalsy();
  });

  test("deleteSecretForRepo with Actions target should call set secret endpoint for Actions", async () => {
    await deleteSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      false,
      "actions",
      "salt"
    );
    expect(deleteActionsSecretMock.isDone()).toBeTruthy();
  });

  test("deleteSecretForRepo with Dependabot target should call set secret endpoint for Dependabot", async () => {
    await deleteSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      "",
      false,
      "dependabot",
      "salt"
    );
    expect(deleteDependabotSecretMock.isDone()).toBeTruthy();
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
      "actions",
      "salt"
    );
    expect(deleteSecretMock.isDone()).toBeFalsy();
  });

  test("deleteSecretForRepo should not delete secret with Dependabot target", async () => {
    await deleteSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      true,
      "dependabot",
      "salt"
    );
    expect(deleteSecretMock.isDone()).toBeFalsy();
  });

  test("deleteSecretForRepo with Actions target should call set secret endpoint for Actions", async () => {
    await deleteSecretForRepo(
      octokit,
      "FOO",
      secrets.FOO,
      repo,
      repoEnvironment,
      false,
      "actions",
      "salt"
    );
    expect(nock.isDone()).toBeTruthy();
  });

  test("deleteSecretForRepo should return AuditLog", async () => {
    const secret_name = "FOO";
    const dry_run = false;
    const target = "actions";

    const auditLog = await deleteSecretForRepo(
      octokit,
      secret_name,
      secrets.FOO,
      repo,
      repoEnvironment,
      dry_run,
      target,
      "salt"
    );
    expect(auditLog.action === "delete");
    expect(auditLog.repo === repo.full_name);
    expect(auditLog.dry_run === dry_run);
    expect(auditLog.environment === repoEnvironment);
    expect(auditLog.target === target);
    expect(auditLog.secret_name == secret_name);
    expect(auditLog.secret_hash != null);
  });
});
