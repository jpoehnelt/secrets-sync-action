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
import * as variables from "../src/variables";

// @ts-ignore-next-line
import fixture from "@octokit/fixtures/scenarios/api.github.com/get-repository/normalized-fixture.json";
import nock from "nock";
import { run } from "../src/main";

nock.disableNetConnect();

beforeEach(() => {});

test("run should succeed with a repo and variable", async () => {
  (github.listAllMatchingRepos as jest.Mock) = jest
    .fn()
    .mockImplementation(async () => [fixture[0].response]);

  (github.setVariableForRepo as jest.Mock) = jest
    .fn()
    .mockImplementation(async () => null);

  (variables.getVariables as jest.Mock) = jest.fn().mockReturnValue({
    BAZ: "bar",
  });

  (config.getConfig as jest.Mock) = jest.fn().mockReturnValue({
    GITHUB_TOKEN: "token",
    SECRETS: ["BAZ"],
    REPOSITORIES: [".*"],
    REPOSITORIES_LIST_REGEX: true,
    DRY_RUN: false,
    RETRIES: 3,
    CONCURRENCY: 1,
    TARGET: "actions",
  });
  await run();

  expect(github.listAllMatchingRepos as jest.Mock).toBeCalledTimes(1);
  expect((github.setVariableForRepo as jest.Mock).mock.calls[0][3]).toEqual(
    fixture[0].response
  );

  expect(process.exitCode).toBe(undefined);
});

test("run should succeed with a repo and variable with repository_list_regex as false", async () => {
  (github.getRepos as jest.Mock) = jest
    .fn()
    .mockImplementation(async () => [fixture[0].response]);

  (github.setVariableForRepo as jest.Mock) = jest
    .fn()
    .mockImplementation(async () => null);

  (variables.getVariables as jest.Mock) = jest.fn().mockReturnValue({
    BAZ: "bar",
  });

  (config.getConfig as jest.Mock) = jest.fn().mockReturnValue({
    GITHUB_TOKEN: "token",
    SECRETS: ["BAZ"],
    REPOSITORIES: [fixture[0].response.full_name],
    REPOSITORIES_LIST_REGEX: false,
    DRY_RUN: false,
    CONCURRENCY: 1,
    TARGET: "actions",
  });
  await run();

  expect(github.getRepos as jest.Mock).toBeCalledTimes(1);
  expect((github.setVariableForRepo as jest.Mock).mock.calls[0][3]).toEqual(
    fixture[0].response
  );

  expect(process.exitCode).toBe(undefined);
});

test("run should succeed with delete enabled, a repo and variable with repository_list_regex as false", async () => {
  (github.deleteVariableForRepo as jest.Mock) = jest
    .fn()
    .mockImplementation(async () => null);

  (config.getConfig as jest.Mock) = jest.fn().mockReturnValue({
    GITHUB_TOKEN: "token",
    SECRETS: ["BAZ"],
    REPOSITORIES: [fixture[0].response.full_name],
    REPOSITORIES_LIST_REGEX: false,
    DRY_RUN: false,
    RUN_DELETE: true,
    CONCURRENCY: 1,
    TARGET: "actions",
  });
  await run();

  expect(github.deleteVariableForRepo as jest.Mock).toBeCalledTimes(1);
  expect(process.exitCode).toBe(undefined);
});

