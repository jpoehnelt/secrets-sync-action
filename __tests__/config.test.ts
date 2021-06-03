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
    .filter(k => k.match(/INPUT_.*/))
    .forEach(k => {
      process.env[k] = "";
    });
}

describe("getConfig", () => {
  const SECRETS = ["FOO.*", "^BAR$"];
  const REPOSITORIES = ["google/baz.*", "^google/foo$"];
  const REPOSITORIES_LIST_REGEX = true;
  const GITHUB_TOKEN = "token";
  const DRY_RUN = false;
  const RETRIES = 3;
  const CONCURRENCY = 50;
  const RUN_DELETE = false;

  const inputs = {
    INPUT_GITHUB_TOKEN: GITHUB_TOKEN,
    INPUT_SECRETS: SECRETS.join("\n"),
    INPUT_REPOSITORIES: REPOSITORIES.join("\n"),
    INPUT_REPOSITORIES_LIST_REGEX: String(REPOSITORIES_LIST_REGEX),
    INPUT_DRY_RUN: String(DRY_RUN),
    INPUT_RETRIES: String(RETRIES),
    INPUT_CONCURRENCY: String(CONCURRENCY),
    INPUT_RUN_DELETE: String(RUN_DELETE)
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
      GITHUB_TOKEN,
      SECRETS,
      REPOSITORIES,
      REPOSITORIES_LIST_REGEX,
      DRY_RUN,
      RETRIES,
      CONCURRENCY,
      RUN_DELETE
    });
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
      ["", false]
    ];

    for (const [value, expected] of cases) {
      process.env["INPUT_DRY_RUN"] = value;
      const actual = getConfig().DRY_RUN;
      expect(`${value}=${actual}`).toEqual(`${value}=${expected}`);
    }
  });
});
