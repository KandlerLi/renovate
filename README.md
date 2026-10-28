# renovate

Self-hosted [Renovate](https://docs.renovatebot.com/) for every
KandlerLi repository (tracker #42). It opens update PRs; merging stays
manual, through each repo's own CI and review.

- `config.js` is the only config: target repos, their time windows,
  limits, grouping and the custom managers. Target repos need no
  `renovate.json`.
- `.github/workflows/renovate.yml` runs it at 00:17 and 02:17 UTC on a
  GitHub-hosted runner. It reads the GitHub App's credentials from
  Secrets Manager (`renovate/github-app`) through this repo's AWS apply
  role and mints a short-lived installation token; no Actions secret
  holds them.

## Load

Renovate itself never touches the homeserver, but each PR it opens runs
that repo's CI, much of it on the self-hosted runners. So:

- Each repo has its own weekly two-hour window; repos with self-hosted
  CI never share a night slot (`slots` in `config.js`).
- At most one new PR per repo and hour, three open per repo.
- Minor, patch and digest updates come as one `non-major` PR per repo;
  majors and k3s come alone.
- Lockfile maintenance (Terraform providers within their constraints)
  runs monthly, on a different day per repo.
- New releases wait three days before Renovate offers them.

## What it updates

Built-in managers: Terraform providers and modules,
`.terraform.lock.hcl`, GitHub Actions SHAs, reusable-workflow tags,
Dockerfiles, pip, Go modules. Custom regex managers: digest-pinned image
strings in `.tf`/`.tfvars` and in workflow matrices, the Ansible
`*_image_name/_tag/_digest` triples, `k3s_node_version`,
`k3s_node_terraform_version`, and this repo's own `RENOVATE_VERSION`.

Not covered on purpose: this account's own images (digest only, updated
after each build), Nextcloud AIO (`:latest`, updates itself), and
version/checksum pairs such as `TERRAFORM_VERSION` in the CI
Dockerfiles, which Renovate can't keep consistent.

## Going live

`dryRun: "full"` in `config.js` makes a run log what it would do and
change nothing. Check a manual run's log (*Actions → Renovate → Run
workflow*), then remove the line in a PR.

## Adding a repo

Add a `slots` entry with a free window, and add the repo to the App's
installation (*Settings → GitHub Apps → kandlerli-renovate →
Configure*).
