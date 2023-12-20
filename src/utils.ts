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

// @ts-ignore-next-line
import { seal } from "tweetsodium";

import crypto from "crypto";

export function encrypt(value: string, key: string): string {
  // Convert the message and key to Uint8Array's (Buffer implements that interface)
  const messageBytes = Buffer.from(value, "utf8");
  const keyBytes = Buffer.from(key, "base64");

  // Encrypt using LibSodium
  const encryptedBytes = seal(messageBytes, keyBytes);

  // Base64 the encrypted secret
  const encrypted = Buffer.from(encryptedBytes).toString("base64");

  // tell Github to mask this from logs
  core.setSecret(encrypted);

  return encrypted;
}

// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2
const hashing_iterations = 210000;
const hashing_key_length = 5;

export function hash(value: string, salt: string): string {
  return crypto
    .pbkdf2Sync(value, salt, hashing_iterations, hashing_key_length, "sha512")
    .toString("hex");
}
