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

/**
 * Get Variables from the current environment using patterns to match keys.
 * @param patterns
 * @param env
 */
export function getVariables(
  patterns: string[],
  env: NodeJS.ProcessEnv = process.env
): { [key: string]: string } {
  const regexPatterns = patterns.map((s) => new RegExp(s));
  const keys = Object.keys(env);

  core.info(`Available env keys: ${JSON.stringify(keys)}`);

  return keys
    .filter((k: string) => {
      return env[k] && regexPatterns.filter((r) => r.test(k)).length;
    })
    .reduce((o: { [key: string]: string }, k: string) => {
      // tell Github to mask this from logs
      if (!k.match(/GITHUB_.*/)) {
        core.setSecret(env[k] as string);
      }

      o[k] = env[k] as string;

      return o;
    }, {});
}
