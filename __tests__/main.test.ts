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
import * as github from "../src/github";
import * as secrets from "../src/secrets";

// @ts-ignore-next-line
import fixture from "@octokit/fixtures/scenarios/api.github.com/get-repository/normalized-fixture.json";
import nock from "nock";
import { run } from "../src/main";

nock.disableNetConnect();

beforeEach(() => {});

test("run should succeed with a repo and secret", async () => {
  (github.listAllMatchingRepos as jest.Mock) = jest
    .fn()
    .mockImplementation(async () => [fixture[0].response]);

  (github.setSecretForRepo as jest.Mock) = jest
    .fn()
    .mockImplementation(async () => null);

  (secrets.getSecrets as jest.Mock) = jest.fn().mockReturnValue({
    BAZ: "bar"
  });

  (config.getConfig as jest.Mock) = jest.fn().mockReturnValue({
    GITHUB_TOKEN: "token",
    SECRETS: ["BAZ"],
    REPOSITORIES: [".*"],
    REPOSITORIES_LIST_REGEX: true,
    DRY_RUN: false,
    RETRIES: 3,
    CONCURRENCY: 1
  });
  await run();

  expect(github.listAllMatchingRepos as jest.Mock).toBeCalledTimes(1);
  expect((github.setSecretForRepo as jest.Mock).mock.calls[0][3]).toEqual(
    fixture[0].response
  );

  expect(process.exitCode).toBe(undefined);
});

test("run should succeed with a repo and secret with repository_list_regex as false", async () => {
  (github.setSecretForRepo as jest.Mock) = jest
    .fn()
    .mockImplementation(async () => null);

  (secrets.getSecrets as jest.Mock) = jest.fn().mockReturnValue({
    BAZ: "bar"
  });

  (config.getConfig as jest.Mock) = jest.fn().mockReturnValue({
    GITHUB_TOKEN: "token",
    SECRETS: ["BAZ"],
    REPOSITORIES: [fixture[0].response.full_name],
    REPOSITORIES_LIST_REGEX: false,
    DRY_RUN: false,
    CONCURRENCY: 1
  });
  await run();

  expect((github.setSecretForRepo as jest.Mock).mock.calls[0][3]).toEqual({
    full_name: fixture[0].response.full_name
  });

  expect(process.exitCode).toBe(undefined);
});

test("run should succeed with delete enabled, a repo and secret with repository_list_regex as false", async () => {
  (github.deleteSecretForRepo as jest.Mock) = jest
    .fn()
    .mockImplementation(async () => null);

  (config.getConfig as jest.Mock) = jest.fn().mockReturnValue({
    GITHUB_TOKEN: "token",
    SECRETS: ["BAZ"],
    REPOSITORIES: [fixture[0].response.full_name],
    REPOSITORIES_LIST_REGEX: false,
    DRY_RUN: false,
    RUN_DELETE: true,
    CONCURRENCY: 1
  });
  await run();

  expect(github.deleteSecretForRepo as jest.Mock).toBeCalledTimes(1);
  expect(process.exitCode).toBe(undefined);
});
