# Secrets Sync Action

![Build](https://github.com/jpoehnelt/secrets-sync-action/workflows/Build/badge.svg)
![Release](https://github.com/jpoehnelt/secrets-sync-action/workflows/Release/badge.svg)
[![codecov](https://codecov.io/gh/jpoehnelt/secrets-sync-action/branch/master/graph/badge.svg)](https://codecov.io/gh/jpoehnelt/secrets-sync-action)
![GitHub contributors](https://img.shields.io/github/contributors/jpoehnelt/secrets-sync-action?color=green)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

A Github Action that can sync secrets from one repository to many others. This action allows a maintainer to define and rotate secrets in a single repository and have them synced to all other repositories in the Github organization or beyond. Secrets do not need to be sensitive and could also be specific build settings that would apply to all repositories and become available for all actions. Regex is used to select the secrets and the repositories. Exclude is currently not supported, and it is recommended to use a bot user if possible.

## Inputs

### `github_token`

**Required**, Token to use to get repos and write secrets. `${{secrets.GITHUB_TOKEN}}` will **not** work as it does not have the necessary scope for other repositories. This token should have the full "repo" scope. In older instances of GitHub, a fine-grained token may not support the required GraphQL API and a "Classic" personal access token would be required. As this is deprecated, please try a fine-grained token first.

### `repositories`

**Required**, Newline delimited regex expressions to select repositories. Repositories are limited to those in which the token user is an owner or collaborator. Set `repositories_list_regex` to `False` to use a hardcoded list of repositories. Archived repositories will be ignored.

### `github_api_url`

Override the default GitHub API URL. When not provided, the action will attempt to use an environment variable provided by the GitHub Action runner environment defaults.

### `repositories_list_regex`

If this value is `true` (default), the action will find all repositories available to the token user and filter based upon the regex provided. If it is `false`, it is expected that `repositories` will be a newline delimited list in the form of org/name.

### `secrets`

**Required**, Newline delimited regex expressions to select values from `process.env`. Use the action env to pass secrets from the repository in which this action runs with the `env` attribute of the step.

### `retries`

The number of retries to attempt when making Github calls when triggering rate limits or abuse limits. Defaults to 3.

### `concurrency`

The number of allowed concurrent calls to the set secret endpoint. Lower this number to avoid abuse limits. Defaults to 10.

### `dry_run`

Run everything except secret create and update functionality.

### `delete`

When set to `true`, the action will find and delete the selected secrets from repositories. Defaults to `false`.

### `environment`

If this value is set to the name of a valid environment in the target repositories, the action will not set repository secrets but instead only set environment secrets for the specified environment. When not set, will set repository secrets only.

## Usage

```yaml
uses: jpoehnelt/secrets-sync-action@[insert version or commit]
  with:
    SECRETS: |
      ^FOO$
      ^GITHUB_.*
    REPOSITORIES: |
      ${{github.repository}}
    DRY_RUN: true
    GITHUB_TOKEN: ${{ secrets.PERSONAL_GITHUB_TOKEN_CLASSIC }}
    GITHUB_API_URL: ${{ secrets.CUSTOM_GITHUB_API_URL }}
    CONCURRENCY: 10
  env:
    FOO: ${{github.run_id}}
    FOOBAR: BAZ
```

See the workflows in this repository for another example.
