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

import { encrypt, hash } from "../src/utils";

const key = "HRkzRZD1+duhfvNvY8eiCPb+ihIjbvkvRyiehJCs8Vc=";

test("encrypt should return a value", () => {
  expect(encrypt("baz", key)).toBeTruthy();
});

test("hashing the same value should return the same result", async () => {
  const value = "baz";
  const salt = "salt";
  const hashed_value_1 = hash(value, salt);
  const hashed_value_2 = hash(value, salt);

  expect(hashed_value_1 === hashed_value_2);
});
