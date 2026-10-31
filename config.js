// Global Renovate config for every KandlerLi repo: see README.

// [repo, weekday (0 = Sunday), lockfile day of month]. One window, 00:00-05:59 Berlin: GitHub starts the
// hourly workflow only every ~4-6 h, so narrower windows were missed (tracker #44). At most two
// self-hosted-CI repos share a night (tracker #12).
const slots = [
  ["k3s-apps", 1, 1],
  ["home-infra", 2, 2],
  ["dyndns", 3, 3],
  ["website", 3, 4],
  ["aws-budget", 4, 5],
  ["homeserver-health-check", 4, 6],
  ["ses-relay", 5, 7],
  ["secrets-manager", 5, 8],
  // GitHub-hosted CI only.
  ["repo-infra", 6, 9],
  ["terraform-state", 6, 10],
  ["k3s-bootstrap", 6, 11],
  ["gha-common", 6, 12],
  ["terraform-provider-fritzbox", 0, 13],
  ["fritzbox", 0, 14],
  ["home-infra-docs", 0, 15],
  ["renovate", 0, 16],
];

const repo = (name) => `KandlerLi/${name}`;

// Rolled out by hand after merging; their required rollout-ack check (gha-common) wants this ticked.
const rolledOutByHand = ["home-infra", "k3s-bootstrap", "terraform-state", "repo-infra", "fritzbox"];

module.exports = {
  platform: "github",
  repositories: slots.map(([name]) => repo(name)),
  onboarding: false,
  requireConfig: "optional",
  dependencyDashboard: false,
  // Commits through the API, so GitHub signs them.
  platformCommit: "enabled",
  timezone: "Europe/Berlin",
  extends: ["config:recommended"],

  prHourlyLimit: 1,
  prConcurrentLimit: 3,
  minimumReleaseAge: "3 days",
  lockFileMaintenance: { enabled: true },
  // Without these GitHub notifies nobody about the App's PRs; review requests also land in the /pulls inbox.
  assignees: ["KandlerLi"],
  reviewers: ["KandlerLi"],

  customManagers: [
    {
      // Digest-pinned image refs in Terraform and in the security-scan matrices.
      customType: "regex",
      managerFilePatterns: ["/\\.tf$/", "/\\.tfvars$/", "/^\\.github/workflows/[^/]+\\.ya?ml$/"],
      matchStrings: [
        "(?<depName>[a-z0-9][a-z0-9./_-]*):(?<currentValue>[A-Za-z0-9][A-Za-z0-9._-]*)@(?<currentDigest>sha256:[a-f0-9]{64})",
      ],
      datasourceTemplate: "docker",
    },
    {
      // Ansible keeps name, tag and digest in three variables.
      customType: "regex",
      managerFilePatterns: ["/^ansible/roles/[^/]+/defaults/main\\.yml$/"],
      matchStrings: [
        "_image_name: (?<depName>\\S+)\\n\\S+_image_tag: (?<currentValue>\\S+)\\n\\S+_image_digest: >-\\n\\s+(?<currentDigest>sha256:[a-f0-9]{64})",
      ],
      datasourceTemplate: "docker",
    },
    {
      customType: "regex",
      managerFilePatterns: ["/^ansible/roles/k3s_node/defaults/main\\.yml$/"],
      matchStrings: ["k3s_node_version: (?<currentValue>\\S+)"],
      depNameTemplate: "k3s-io/k3s",
      datasourceTemplate: "github-releases",
      versioningTemplate: "regex:^v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)\\+k3s(?<build>\\d+)$",
    },
    {
      customType: "regex",
      managerFilePatterns: ["/^ansible/roles/k3s_node/defaults/main\\.yml$/"],
      matchStrings: ['k3s_node_terraform_version: "(?<currentValue>[^"]+)"'],
      depNameTemplate: "hashicorp/terraform",
      datasourceTemplate: "github-releases",
      extractVersionTemplate: "^v(?<version>.+)$",
    },
    {
      // This repo's own Renovate pin, in both workflows.
      customType: "regex",
      managerFilePatterns: ["/^\\.github/workflows/[^/]+\\.ya?ml$/"],
      matchStrings: ["RENOVATE_VERSION: (?<currentValue>\\S+)"],
      depNameTemplate: "renovate",
      datasourceTemplate: "npm",
    },
  ],

  packageRules: [
    // The regex manager above owns Terraform's image strings.
    { matchManagers: ["terraform"], matchDatasources: ["docker"], enabled: false },
    // Built from terraform-provider-fritzbox and not in any registry; bumped by hand.
    { matchPackageNames: ["kandlerli/fritzbox"], enabled: false },
    // One PR per repo for everything below a major; k3s always on its own, it upgrades the cluster, and own images too.
    {
      matchUpdateTypes: ["minor", "patch", "digest", "pinDigest"],
      matchDepNames: ["!k3s-io/k3s", "!ghcr.io/kandlerli/**"],
      groupName: "non-major",
    },
    ...slots.map(([name, weekday]) => ({
      matchRepositories: [repo(name)],
      schedule: [`* 0-5 * * ${weekday}`],
    })),
    // Own images: a fresh build should be pinned right away, without waiting.
    {
      matchDepNames: ["ghcr.io/kandlerli/**"],
      schedule: ["at any time"],
      minimumReleaseAge: null,
    },
    ...slots.map(([name, , day]) => ({
      matchRepositories: [repo(name)],
      matchUpdateTypes: ["lockFileMaintenance"],
      schedule: [`* 0-5 ${day} * *`],
    })),
    {
      matchRepositories: rolledOutByHand.map(repo),
      prBodyNotes: [
        "- [ ] I roll this out myself after merging, or nothing here needs a rollout. <!-- rollout-ack -->",
      ],
    },
  ],
};
