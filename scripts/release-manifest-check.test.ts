import { readFileSync as readFileSyncRaw } from "node:fs"

import { describe, expect, it } from "vitest"

import { createReleasePlan } from "./release-manifest-check.ts"

const coreName = "@benjamolina/antigravity-guard-core"
const piName = "@benjamolina/pi-antigravity-guard"
const rootName = "@benjamolina/opencode-antigravity-guard"
const repositoryUrl = "git+https://github.com/BenjaMolina/opencode-antigravity-guard.git"
const piVersion = "0.4.3"
const rootVersion = "1.1.17"

function readFileSync(path: URL, encoding: "utf8"): string {
  return readFileSyncRaw(path, encoding).replaceAll("\r\n", "\n")
}

function repository(directory?: string) {
  return {
    type: "git",
    url: repositoryUrl,
    ...(directory === undefined ? {} : { directory }),
  }
}

function validManifests() {
  return {
    root: {
      name: rootName,
      version: rootVersion,
      dependencies: { [coreName]: "0.1.0" },
      repository: repository(),
    },
    core: {
      name: coreName,
      version: "0.1.0",
      repository: repository("packages/core"),
    },
    pi: {
      name: piName,
      version: piVersion,
      dependencies: { [coreName]: "0.1.0" },
      repository: repository("packages/pi"),
    },
    lockfile: {
      packages: {
        "": {
          name: rootName,
          version: rootVersion,
          dependencies: { [coreName]: "0.1.0" },
        },
        "packages/core": {
          name: coreName,
          version: "0.1.0",
        },
        "packages/pi": {
          name: piName,
          version: piVersion,
          dependencies: { [coreName]: "0.1.0" },
        },
      },
    },
  }
}

describe("release workflow", () => {
  it("publishes only from the main branch for push and manual dispatch", () => {
    const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8")

    expect(workflow).toMatch(
      /jobs:\s*\n\s+publish:\s*\n\s+if: github\.ref == 'refs\/heads\/main'/,
    )
  })
})

function publishScript(workflow: string): string {
  const match = workflow.match(
    /- name: Publish missing packages in dependency order[\s\S]*?run: \|\n(?<script>[\s\S]*?)\n\s+- name: Create matching tag and release/,
  )
  expect(match?.groups?.script).toBeDefined()
  return match?.groups?.script ?? ""
}

function expectBoundedRegistrySettle(workflow: string): void {
  const script = publishScript(workflow)
  const settleFunction = script.match(
    /wait_for_registry\(\) \{(?<body>[\s\S]*?)\n\s+\}\n\n\s+publish_if_missing\(\)/,
  )?.groups?.body

  expect(settleFunction).toBeDefined()
  expect(settleFunction).toMatch(/local timeout_seconds=900/)
  expect(settleFunction).toMatch(/local interval_seconds=30/)
  expect(settleFunction).toMatch(/query_exact_version "\$name" "\$version" "\$requires_core"/)
  expect(settleFunction).toMatch(/sleep "\$interval_seconds"/)
  expect(settleFunction).toMatch(/Timed out waiting for .* to appear in the npm registry/)
  expect(settleFunction).not.toMatch(/npm publish/)
  expect(script).toMatch(
    /npm publish[\s\S]*?\n\n\s+if ! wait_for_registry "\$name" "\$version" "\$requires_core"; then/,
  )
}

function expectRepositoryLocalTagIdentity(workflow: string): void {
  const tagScript = workflow.match(
    /- name: Create matching tag and release[\s\S]*?run: \|\n(?<script>[\s\S]*)/,
  )?.groups?.script

  expect(tagScript).toBeDefined()
  expect(tagScript).toMatch(
    /git config --local user\.name "github-actions\[bot\]"\n\s+git config --local user\.email "41898282\+github-actions\[bot\]@users\.noreply\.github\.com"\n\s+git tag -a "\$TAG"/,
  )
  expect(tagScript).not.toMatch(/git config --global/)
}

function expectPlannedStaticVersions(workflow: string): void {
  expect(workflow).toContain(
    'publish_if_missing "@benjamolina/antigravity-guard-core" "0.1.0" "@benjamolina/antigravity-guard-core" false',
  )
  expect(workflow).toContain(
    `publish_if_missing "@benjamolina/pi-antigravity-guard" "${piVersion}" "@benjamolina/pi-antigravity-guard" true`,
  )
  expect(workflow).toContain(
    `publish_if_missing "@benjamolina/opencode-antigravity-guard" "${rootVersion}" "" true`,
  )
  expect(workflow).toContain(`TAG="v${rootVersion}"`)
  expect(workflow).toContain(`@benjamolina/pi-antigravity-guard@${piVersion}`)
  expect(workflow).toContain(`@benjamolina/opencode-antigravity-guard@${rootVersion}`)
}

describe("release workflow", () => {
  it("uses the planned static versions for publication, tag, and release notes", () => {
    const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8")

    expectPlannedStaticVersions(workflow)
  })

  it("rejects stale Pi and root workflow versions", () => {
    const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8")

    expect(() => expectPlannedStaticVersions(workflow.replace(`"${piVersion}"`, '"0.1.0"'))).toThrow()
    expect(() => expectPlannedStaticVersions(workflow.replace(`"${rootVersion}"`, '"1.1.11"'))).toThrow()
  })

  it("waits up to 15 minutes for a successful publish to settle through exact registry readback", () => {
    const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8")

    expectBoundedRegistrySettle(workflow)
    expect(() => expectBoundedRegistrySettle(workflow.replace("local timeout_seconds=900", "local timeout_seconds=600"))).toThrow()
  })

  it("sets repository-local GitHub Actions identity immediately before creating an annotated tag", () => {
    const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8")

    expectRepositoryLocalTagIdentity(workflow)
    expect(() => expectRepositoryLocalTagIdentity(workflow.replaceAll("--local", "--global"))).toThrow()
  })
})

describe("createReleasePlan", () => {
  it("returns the serial core, Pi, root publication order", () => {
    const plan = createReleasePlan(validManifests())

    expect(plan).toEqual([
      { name: coreName, version: "0.1.0", workspace: "packages/core" },
      { name: piName, version: piVersion, workspace: "packages/pi" },
      { name: rootName, version: rootVersion, workspace: undefined },
    ])
  })

  it("rejects a mismatched lock version", () => {
    const manifests = validManifests()
    manifests.lockfile.packages["packages/pi"]!.version = "0.1.1"

    expect(() => createReleasePlan(manifests)).toThrow()
  })

  it("rejects a ranged root core dependency", () => {
    const manifests = validManifests()
    manifests.root.dependencies[coreName] = "^0.1.0"

    expect(() => createReleasePlan(manifests)).toThrow()
  })

  it("rejects a prerelease Pi version", () => {
    const manifests = validManifests()
    manifests.pi.version = "0.1.0-rc.1"

    expect(() => createReleasePlan(manifests)).toThrow()
  })

  it("rejects an empty Core repository URL", () => {
    const manifests = validManifests()
    manifests.core.repository.url = ""

    expect(() => createReleasePlan(manifests)).toThrow("packages/core repository URL")
  })

  it("rejects a mismatched root repository URL", () => {
    const manifests = validManifests()
    manifests.root.repository.url = "git+https://github.com/example/fork.git"

    expect(() => createReleasePlan(manifests)).toThrow("root repository URL")
  })

  it("rejects a mismatched Pi repository directory", () => {
    const manifests = validManifests()
    manifests.pi.repository.directory = "packages/core"

    expect(() => createReleasePlan(manifests)).toThrow("packages/pi repository directory")
  })
})
