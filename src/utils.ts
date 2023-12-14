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

import sodium from "libsodium-wrappers";
import { createHash } from "crypto";

export async function encrypt(value: string, key: string): Promise<string> {
  // https://docs.github.com/en/rest/guides/encrypting-secrets-for-the-rest-api?apiVersion=2022-11-28#example-encrypting-a-secret-using-nodejs

  // Ensure libsodium is ready before performing operations
  await sodium.ready;

  // Convert the secret and key to a Uint8Array.
  const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const binsec = sodium.from_string(value);

  // Encrypt the secret using libsodium
  const encBytes = sodium.crypto_box_seal(binsec, binkey);

  // Convert the encrypted Uint8Array to Base64
  return sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
}

export async function hash(value: string): Promise<string> {
  return createHash("sha256").update(value).digest("hex");
}
