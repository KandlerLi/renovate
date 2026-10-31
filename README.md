# renovate

Self-hosted [Renovate](https://docs.renovatebot.com/) for every
KandlerLi repository (tracker #42). It opens update PRs; merging stays
manual, through each repo's own CI and review.
Every PR is assigned to KandlerLi and requests a review from
KandlerLi, which triggers GitHub's notification and puts it in the
/pulls inbox.

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

- Each repo has its weekday; the window is 00:00-05:59 Berlin time, and
  at most two repos with self-hosted CI share a night (`slots` in
  `config.js`). The workflow is set to start hourly, but GitHub starts it
  only every ~4-6 hours, hence the wide window. Outside a repo's window
  Renovate only checks and opens nothing.
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

Own images (`ghcr.io/kandlerli/home-agent`, `sankey-export`) are pinned
as `:main@sha256:…`; each build pushes the `main` tag, and Renovate
proposes the new digest at its next run, outside any time window and
without the three-day wait. They are private, so the workflow reads the
GHCR pull token (`k3s-apps/ghcr-pull-token`) and passes it as a host
rule for ghcr.io.

Not covered on purpose: this account's own `kandlerli/fritzbox` provider, Nextcloud AIO (`:latest`, updates itself), and
version/checksum pairs such as `TERRAFORM_VERSION` in the CI
Dockerfiles, which Renovate can't keep consistent.

## Repos rolled out by hand

PRs for `rolledOutByHand` in `config.js` get the rollout checkbox that
those repos' required `rollout-ack` check (gha-common) waits for. Tick it
only when you will roll the update out after merging.

## Checking a run

*Actions → Renovate → Run workflow*, `log_level: debug` for details
such as GitHub API errors. Adding `dryRun: "full"` to `config.js`
makes runs log what they would do without touching any repo.

## Adding a repo

Add a `slots` entry on a quiet weekday, and add the repo to the App's
installation (*Settings → GitHub Apps → kandlerli-renovate →
Configure*).
