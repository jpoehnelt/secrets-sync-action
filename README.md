# Secrets & variables sync action

⚙️ Set secrets or variables on multiple repos at once!

<div align="center">

![]()

</div>

🧰 AiO toolkit for setting and deleting secrets and [variables] \
🔄 Lets you sync secrets across multiple repositories \
🔎 Use the [GitHub Search] syntax with a `query` input \
🗑️ Lets you programmatically remove variables and secrets

🛑 GitHub natively supports **user-level Codespaces secrets**,
**organization-level Actions, Codespaces, and Dependabot secrets**, and
**organization-level Actions variables**. Use these if possible.

## Usage

![GitHub Actions](https://img.shields.io/static/v1?style=for-the-badge&message=GitHub+Actions&color=2088FF&logo=GitHub+Actions&logoColor=FFFFFF&label=)
![GitHub](https://img.shields.io/static/v1?style=for-the-badge&message=GitHub&color=181717&logo=GitHub&logoColor=FFFFFF&label=)

First, you'll need a 🗝️ [PAT]. The default `${{ secrets.GITHUB_TOKEN }}` doesn't
have access to set secrets on other repositories. You'll need to [create a PAT]
with access to the "secrets" permission either for a single repo, multiple
repos, or all repos.

After getting your PAT, find the repository that you want to serve as the
"source" for all your secrets. Then, you'll want to add your custom PAT to that
repo's secrets.

Now comes the fun part: writing a workflow `.yml` file! The most popular way to
use this action is on a timer coupled with an `on: push` trigger to re-run it
whenever you update the `.yml` file itself. For example, here's a complete
workflow file that will sync the current repo's secrets across your entire
user account!

```yml
name: Update user secrets
on:
  push:
    branches: "main"
    paths: .github/workflows/update-user-secrets-and-variables.yml
  schedule:
    # https://crontab.guru/every-day
    - cron: "0 0 * * *"
  workflow_dispatch:
concurrency:
  group: ${{ github.workflow }}
  cancel-in-progress: true
jobs:
  update-user-secrets-and-variables:
    runs-on: ubuntu-latest
    steps:
      - uses: jpoehnelt/secrets-sync-action@v2
        with:
          token: ${{ secrets.USER_SECRETS_TOKEN }}
          query: user:octocat
          set-secrets: |
            NPM_TOKEN=${{ secrets.NPM_TOKEN }}
            VERCEL_TOKEN=${{ secrets.VERCEL_TOKEN }}
          set-variables: |
            NODE_VERSION=${{ vars.NODE_VERSION }}
            MESSAGE=hello
```

💡 If you're configuring something like a build setting (think `NODE_VERSION`),
you should use [GitHub Variables] instead of GitHub Secrets.

💡 It's recommended to run this action on a `cron: "0 0 * * *"` or similar
schedule so that any changes to the `${{ secrets.* }}` values are reflected on
the synced repos soon-ish. You can use [crontab guru] to play around with cron
expressions.

<details><summary>You can also explicitly list your repositories if you prefer</summary>

```yml
- uses: jpoehnelt/secrets-sync-action@v2
  with:
    token: ${{ secrets.USER_SECRETS_TOKEN }}
    repositories: |
      octocat/awesome-project
      octocat/my-library
      octocat/hello-world
    set-secrets: |
      NPM_TOKEN=${{ secrets.NPM_TOKEN }}
      VERCEL_TOKEN=${{ secrets.VERCEL_TOKEN }}
    set-variables: |
      NODE_VERSION=${{ vars.NODE_VERSION }}
      MESSAGE=hello
```

</details>

<details><summary>If you <em>really</em> need to, you can delete secrets too</summary>

```yml
- uses: jpoehnelt/secrets-sync-action@v2
  with:
    token: ${{ secrets.USER_SECRETS_TOKEN }}
    repositories: |
      octocat/awesome-project
      octocat/my-library
      octocat/hello-world
    delete-secrets: |
      NPM_TOKEN
      VERCEL_TOKEN
    delete-variables: |
      NODE_VERSION
      MESSAGE
```

If you truly want to delete _all_ secrets or variables, you can pass in `true`
to do so.

```yml
- uses: jpoehnelt/secrets-sync-action@v2
  with:
    token: ${{ secrets.USER_SECRETS_TOKEN }}
    repositories: |
      octocat/help
    delete-secrets: true
    delete-variables: true
```

</details>

<details><summary>You can also set organization or user variables and secrets (where natively supported)</summary>

```yml
- uses: jpoehnelt/secrets-sync-action@v2
  with:
    token: ${{ secrets.USER_SECRETS_TOKEN }}
    user: octocat
    secrets-app: codespaces
    set-secrets: |
      NPM_TOKEN=${{ secrets.NPM_TOKEN }}
```

```yml
- uses: jpoehnelt/secrets-sync-action@v2
  with:
    token: ${{ secrets.USER_SECRETS_TOKEN }}
    organization: octocat
    set-secrets: |
      NPM_TOKEN=${{ secrets.NPM_TOKEN }}
```

If you specify the `visibility: selected` option with `organization:`, you can
use the `repository:`, `repositories:`, or `query:` to make that secret only
available to specific repositories under that organization.

```yml
- uses: jpoehnelt/secrets-sync-action@v2
  with:
    token: ${{ secrets.USER_SECRETS_TOKEN }}
    organization: octocat
    repositories: |
      octocat/our-lib
      octocat/awesome-app
    app: dependabot
    set-secrets: |
      NPM_TOKEN=${{ secrets.NPM_TOKEN }}
```

</details>

### Inputs

- **`token`:** The GitHub PAT to use when setting secrets on other repos. You
  can't use the default `${{ secrets.GITHUB_TOKEN }}` for this since it only
  covers the current repository. You'll need to create a PAT with access to the
  "secrets" permission either for a single repo, multiple repos, or all repos.
  This is required.

- **`github-server-url`:** The GitHub server URL to use when setting secrets on
  other repos. This defaults to the GitHub server URL that the action is running
  on. Defaults to the `${{ github.server_url }}` context variable.

- **`dry-run`:** Whether or not to actually set the secrets. Set this to `true`
  when testing this action. Defaults to `false`.

- **`repositories`:** Also available as `repository` alias. A newline-separated
  list of repositories to set the secrets on. You must set at least one of
  `repository`, `repositories`, or `query`.

- **`query`:** A [GitHub Search] query to find repositories to set the secrets
  on. You must set at least one of `repository`, `repositories`, or `query`.
  This input is useful if you want to dynamically expand the list of
  repositories like `user: octocat topic:nodejs` to auto-set the `NPM_TOKEN`
  secret on all your Node.js repos.

- **`app`:** Either `actions`, `codespaces`, or `dependabot`. You can set
  secrets on only one context at a time. The default is `actions` which is
  probably what you want.

- **`set-secrets`:** Also available as `set-secret`. A list of name-value pairs
  in `.env` format like `TOKEN=hello`. You can use `${{ secrets.* }}`
  substitution to interpolate hidden values into these pairs. You must set one
  of `set-secrets`, `set-secret`, `set-variables`, `set-variable`,
  `delete-secret`, `delete-secrets`, `delete-variable`, or `delete-variables`.

- **`set-variables`:** Also available as `set-variable` alias. A name-value pair
  like `MESSAGE=hello`. You can use `${{ variables.* }}` expressions. You must
  set one of `set-secrets`, `set-secret`, `set-variables`, `set-variable`,
  `delete-secret`, `delete-secrets`, `delete-variable`, or `delete-variables`.

- **`delete-secrets`:** Also available as `delete-secret` alias. A newline list
  of names. There are no values. You must set one of `set-secrets`,
  `set-secret`, `set-variables`, `set-variable`, `delete-secret`,
  `delete-secrets`, `delete-variable`, or `delete-variables`.

- **`delete-variables`:** Also available as `delete-variable` alias. A newline list
  of names. There are no values. You must set one of `set-secrets`,
  `set-secret`, `set-variables`, `set-variable`, `delete-secret`,
  `delete-secrets`, `delete-variable`, `delete-variables`.

## Development

![GitHub Actions](https://img.shields.io/static/v1?style=for-the-badge&message=GitHub+Actions&color=2088FF&logo=GitHub+Actions&logoColor=FFFFFF&label=)
![Shell](https://img.shields.io/static/v1?style=for-the-badge&message=Shell&color=4EAA25&logo=GNU+Bash&logoColor=FFFFFF&label=)
![Deno](https://img.shields.io/static/v1?style=for-the-badge&message=Deno&color=000000&logo=Deno&logoColor=FFFFFF&label=)

This project uses the `cliw` script to download and install Deno locally (right
next to the source code in `.deno/`) before using Deno to run the `cli.ts` main
script! We do this Deno dance so that we can use JavaScript/TypeScript stuff
without needing the complicated in-Git `dist/` folder if we used Node.js. To get
started, just open a PR and the CI will run the `test.yml` workflow which will
make sure everything works.

<!-- prettier-ignore-start -->
[crontab guru]: https://crontab.guru/
[PAT]: https://docs.github.com/en/github/authenticating-to-github/keeping-your-account-and-data-secure/creating-a-personal-access-token
[create a PAT]: https://github.com/settings/tokens?type=beta
[GitHub Search]: https://github.com/search
[github variables]: https://docs.github.com/en/actions/learn-github-actions/variables
[github cli]: https://cli.github.com/
<!-- prettier-ignore-end -->
