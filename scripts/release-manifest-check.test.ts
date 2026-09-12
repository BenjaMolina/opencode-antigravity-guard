import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { createReleasePlan } from "./release-manifest-check.ts"

const coreName = "@benjamolina/antigravity-guard-core"
const piName = "@benjamolina/pi-antigravity-guard"
const rootName = "@benjamolina/opencode-antigravity-guard"
const repositoryUrl = "git+https://github.com/BenjaMolina/opencode-antigravity-guard.git"

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
      version: "1.1.11",
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
      version: "0.1.0",
      dependencies: { [coreName]: "0.1.0" },
      repository: repository("packages/pi"),
    },
    lockfile: {
      packages: {
        "": {
          name: rootName,
          version: "1.1.11",
          dependencies: { [coreName]: "0.1.0" },
        },
        "packages/core": {
          name: coreName,
          version: "0.1.0",
        },
        "packages/pi": {
          name: piName,
          version: "0.1.0",
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

describe("createReleasePlan", () => {
  it("returns the serial core, Pi, root publication order", () => {
    const plan = createReleasePlan(validManifests())

    expect(plan).toEqual([
      { name: coreName, version: "0.1.0", workspace: "packages/core" },
      { name: piName, version: "0.1.0", workspace: "packages/pi" },
      { name: rootName, version: "1.1.11", workspace: undefined },
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
