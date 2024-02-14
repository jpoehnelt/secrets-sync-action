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

import { getVariables } from "../src/variables";

const setSecretMock: jest.Mock = jest.fn();

beforeAll(() => {
  // @ts-ignore-next-line
  core.setSecret = setSecretMock;
});

test("getSecrets matches with regex", async () => {
  const env = { FOO: "BAR" };
  expect(getVariables(["FO*"], env)).toEqual(env);
});

test("getSecrets matches multiple keys with regex", async () => {
  const env = { FOO: "BAR", FOOO: "BAR" };
  expect(getVariables(["FO*"], env)).toEqual(env);
});

test("getSecrets matches multiple keys with multiple regexs", async () => {
  const env = { FOO: "BAR", QUZ: "BAR" };
  expect(getVariables(["FOO", "Q.*"], env)).toEqual(env);
});

test("getSecrets regex does not use case insensitive flag", async () => {
  const env = { FOO: "BAR" };
  expect(getVariables(["fo+"], env)).toEqual({});
});

test("getSecrets empty pattern returns no keys", async () => {
  const env = { FOO: "BAR" };
  expect(getVariables([], env)).toEqual({});
});

test("getSecrets using process.env", async () => {
  process.env.FOO = "bar";
  expect(getVariables([".*"]).FOO).toEqual(process.env.FOO);
  delete process.env.FOO;
});

test("getSecrets does not add mask to GITHUB_", async () => {
  const env = { FOO: "BAR", GITHUB_FOO: "GITHUB_BAR" };

  setSecretMock.mockClear();
  getVariables([".*"], env);

  expect((core.setSecret as jest.Mock).mock.calls.length).toBe(1);
  expect((core.setSecret as jest.Mock).mock.calls[0][0]).toBe(env.FOO);
});
