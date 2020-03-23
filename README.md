# Secret Sync Action

![Build](https://github.com/google/secrets-sync-action/workflows/Build/badge.svg)
![Release](https://github.com/google/secrets-sync-action/workflows/Release/badge.svg)
[![codecov](https://codecov.io/gh/google/secrets-sync-action/branch/master/graph/badge.svg)](https://codecov.io/gh/google/secrets-sync-action)
![GitHub contributors](https://img.shields.io/github/contributors/google/secrets-sync-action?color=green)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

A Github Action that can sync secrets from one repository to many others. This action allows a maintainer to define and rotate secrets in a single repository and have them synced to all other repositories in the Github organization or beyond. Secrets do not need to be sensitive and could also be specific build settings that would apply to all repositories and become available to all actions. Regex is used to select the secrets and the repositories. Exclude is currently not supported and it is recommended to use a bot user if possible.

## Inputs

### `github_token`

**Required** Token to use to get repos and write secrets. `${{secrets.GITHUB_TOKEN}}` will **not** work.

### `repositories`

**Required** New line deliminated regex expressions to select repositories. Repositires are limited to those in whcich the token user is an owner or collaborator.

### `secrets`

**Required** New line deliminated regex expressions to select values from `process.env`. Use the action env to pass secrets from the repository in which this action runs with the `env` attribute of the step.

### `dry_run`

Run everything except for secret create and update functionality.

## Usage

```yaml
uses: google/secrets-sync-action@v1.0.0
  with:
    SECRETS: |
      ^FOO$
      ^GITHUB_.*
    REPOSITORIES: |
      ${{github.repository}}
    DRY_RUN: true
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN_SECRETS }}
  env:
    FOO: ${{github.run_id}}
    FOOBAR: BAZ
```

See the workflows in this repository for another example.
