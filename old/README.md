# Set secrets action

🔒 Set secrets on a single repo or multiple repos at once

<div align="center">

![](https://user-images.githubusercontent.com/61068799/241797648-5b80f961-78cc-4e3a-a302-637e6cea2bff.png)

</div>

🔄 Lets you sync secrets across multiple repositories \
🔎 Use the [GitHub Search] syntax with a `query` input

## Usage

![GitHub Actions](https://img.shields.io/static/v1?style=for-the-badge&message=GitHub+Actions&color=2088FF&logo=GitHub+Actions&logoColor=FFFFFF&label=)
![GitHub](https://img.shields.io/static/v1?style=for-the-badge&message=GitHub&color=181717&logo=GitHub&logoColor=FFFFFF&label=)

First, you'll need a [PAT]. The default `${{ secrets.GITHUB_TOKEN }}` doesn't
have access to set secrets on other repositories. You'll need to [create a PAT]
with access to the "secrets" permission either for a single repo, multiple
repos, or all repos.

Then, put something like this in a "dummy" repository that will hold a bunch of
secrets. I like to use my community health file repository (`jcbhmr/.github`)
for this. You can also use this with something like `on: push` if you want to
set secrets dynamically, but I think the most prevelant use case is to sync
secret values across multiple repositories. 😊

```yml
name: Update user secrets
on:
  push:
    branches: "main"
    paths: .github/workflows/update-user-secrets.yml
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:
concurrency:
  group: ${{ github.workflow }}
  cancel-in-progress: true
jobs:
  update-user-secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: jcbhmr/set-secrets-action@v1
        with:
          token: ${{ secrets.USER_SECRETS_TOKEN }}
          repositories: |
            jcbhmr/awesome-project
            jcbhmr/nodejs-cool
            jcbhmr/todo-app
            jcbhmr/wiki-thing
          secrets: |
            NPM_TOKEN=${{ secrets.NPM_TOKEN }}
            VERCEL_TOKEN=${{ secrets.VERCEL_TOKEN }}
```

💡 It's recommended to run this action on a `cron: "0 0 * * *"` or similar
schedule so that any changes to the `${{ secrets.* }}` values is reflected on
the synced repos soon-ish. You can use [crontab guru] to play around with cron
expressions.

You can also use a dynamic [GitHub Search] query to set secrets on multiple
repositories. For instance, you could use `user:${{ github.repository_owner }}`
and `tag:nodejs` to set secrets on all of your Node.js repositories!

```yml
- uses: jcbhmr/set-secrets-action@v1
  with:
    token: ${{ secrets.USER_SECRETS_TOKEN }}
    query: user:${{ github.repository_owner }} tag:nodejs
    secrets: |
      NPM_TOKEN=${{ secrets.NPM_TOKEN }}
      VERCEL_TOKEN=${{ secrets.VERCEL_TOKEN }}
```

ℹ We will **always** auto-exclude the current repository from the list of
repositories to set secrets on. This is to prevent you from accidentally setting
secrets on the repository that is running the action.

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

- **`repository`:** The repository to set the secrets on. This is required if
  you don't set either `repositories` or `query`. You must set at least one of
  `repository`, `repositories`, or `query`.

- **`repositories`:** A newline-separated list of repositories to set the
  secrets on. You must set at least one of `repository`, `repositories`, or
  `query`.

- **`query`:** A [GitHub Search] query to find repositories to set the secrets
  on. You must set at least one of `repository`, `repositories`, or `query`.
  This input is useful if you want to dynamically expand the list of
  repositories to set secrets on based on some criteria like `tag:nodejs` to
  auto-set the `NPM_TOKEN` secret on all Node.js repos.

- **`app`:** Either `actions`, `codespaces`, or `dependabot`. You can set
  secrets on only one context at a time. The default is `actions` which is
  probably what you want.

- **`secret`:** A name-value pair like `HELLO_WORLD=hello`. You must set at
  least one of `secret` or `secrets`.

- **`secrets`:** A newline-separated list of name-value pairs like
  `HELLO_WORLD=hello`. You must set at least one of `secret` or `secrets`.

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
<!-- prettier-ignore-end -->
