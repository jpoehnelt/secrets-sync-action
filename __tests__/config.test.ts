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

import { getConfig } from "../src/config";

function clearInputs() {
  Object.keys(process.env)
    .filter((k) => k.match(/INPUT_.*/))
    .forEach((k) => {
      process.env[k] = "";
    });
}

describe("getConfig", () => {
  const VARIABLES = ["FOO.*", "^BAR$"];
  const REPOSITORIES = ["google/baz.*", "^google/foo$"];
  const REPOSITORIES_LIST_REGEX = true;
  const GITHUB_API_URL = "https://api.github.com";
  const GITHUB_API_URL_OVERRIDE = "overridden_api_url";
  const GITHUB_TOKEN = "token";
  const DRY_RUN = false;
  const RETRIES = 3;
  const CONCURRENCY = 50;
  const RUN_DELETE = false;
  const ENVIRONMENT = "production";
  const TARGET = "actions";

  // Must implement because operands for delete must be optional in typescript >= 4.0
  interface Inputs {
    INPUT_GITHUB_API_URL?: string;
    INPUT_GITHUB_TOKEN: string;
    INPUT_VARIABLES: string;
    INPUT_REPOSITORIES: string;
    INPUT_REPOSITORIES_LIST_REGEX: string;
    INPUT_DRY_RUN: string;
    INPUT_RETRIES: string;
    INPUT_CONCURRENCY: string;
    INPUT_RUN_DELETE: string;
    INPUT_ENVIRONMENT: string;
    INPUT_TARGET: string;
  }
  const inputs: Inputs = {
    INPUT_GITHUB_API_URL: String(GITHUB_API_URL),
    INPUT_GITHUB_TOKEN: GITHUB_TOKEN,
    INPUT_VARIABLES: VARIABLES.join("\n"),
    INPUT_REPOSITORIES: REPOSITORIES.join("\n"),
    INPUT_REPOSITORIES_LIST_REGEX: String(REPOSITORIES_LIST_REGEX),
    INPUT_DRY_RUN: String(DRY_RUN),
    INPUT_RETRIES: String(RETRIES),
    INPUT_CONCURRENCY: String(CONCURRENCY),
    INPUT_RUN_DELETE: String(RUN_DELETE),
    INPUT_ENVIRONMENT: String(ENVIRONMENT),
    INPUT_TARGET: String(TARGET),
  };

  beforeEach(() => {
    clearInputs();
  });

  afterAll(() => {
    clearInputs();
  });

  test("getConfig throws error on missing inputs", async () => {
    expect(() => getConfig()).toThrowError();
  });

  test("getConfig returns arrays for secrets and repositories", async () => {
    process.env = { ...process.env, ...inputs };

    expect(getConfig()).toEqual({
      GITHUB_API_URL,
      GITHUB_TOKEN,
      VARIABLES,
      REPOSITORIES,
      REPOSITORIES_LIST_REGEX,
      DRY_RUN,
      RETRIES,
      CONCURRENCY,
      RUN_DELETE,
      ENVIRONMENT,
      TARGET,
    });
  });

  test("getConfig GITHUB_API_URL has fallback value", async () => {
    const inputsWithoutApiUrl = inputs;
    delete inputsWithoutApiUrl.INPUT_GITHUB_API_URL;
    delete process.env.GITHUB_API_URL;

    process.env = { ...process.env, ...inputsWithoutApiUrl };
    expect(getConfig().GITHUB_API_URL).toEqual(GITHUB_API_URL);
  });

  test("getConfig GITHUB_API_URL uses process.env.GITHUB_API_URL when present", async () => {
    process.env = { ...process.env, ...inputs };
    process.env.GITHUB_API_URL = GITHUB_API_URL_OVERRIDE;
    expect(getConfig().GITHUB_API_URL).toEqual(GITHUB_API_URL_OVERRIDE);
  });

  test("getConfig dry run should work with multiple values of true", async () => {
    process.env = { ...process.env, ...inputs };

    const cases: [string, boolean][] = [
      ["0", false],
      ["1", true],
      ["true", true],
      ["True", true],
      ["TRUE", true],
      ["false", false],
      ["False", false],
      ["FALSE", false],
      ["foo", false],
      ["", false],
    ];

    for (const [value, expected] of cases) {
      process.env["INPUT_DRY_RUN"] = value;
      const actual = getConfig().DRY_RUN;
      expect(`${value}=${actual}`).toEqual(`${value}=${expected}`);
    }
  });
});
