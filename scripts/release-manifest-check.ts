import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

const CORE = {
  name: "@benjamolina/antigravity-guard-core",
  version: "0.1.0",
  workspace: "packages/core",
} as const
const PI = {
  name: "@benjamolina/pi-antigravity-guard",
  version: "0.1.0",
  workspace: "packages/pi",
} as const
const ROOT = {
  name: "@benjamolina/opencode-antigravity-guard",
  version: "1.1.11",
  workspace: undefined,
} as const

export interface ReleasePackage {
  name: string
  version: string
  workspace: string | undefined
}

interface Manifest {
  name?: unknown
  version?: unknown
  dependencies?: unknown
}

interface Lockfile {
  packages?: unknown
}

export interface ReleaseManifests {
  root: Manifest
  core: Manifest
  pi: Manifest
  lockfile: Lockfile
}

const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertStableVersion(value: unknown, label: string, expected: string): void {
  assert(typeof value === "string" && STABLE_SEMVER.test(value), `${label} must be a stable semver`)
  assert(value === expected, `${label} must be ${expected}, received ${value}`)
}

function assertManifest(manifest: Manifest, expected: ReleasePackage): void {
  assert(manifest.name === expected.name, `${expected.workspace ?? "root"} name must be ${expected.name}`)
  assertStableVersion(manifest.version, `${expected.workspace ?? "root"} version`, expected.version)
}

function assertCoreDependency(manifest: Manifest, label: string): void {
  assert(typeof manifest.dependencies === "object" && manifest.dependencies !== null, `${label} dependencies are missing`)
  const dependencies = manifest.dependencies as Record<string, unknown>
  assert(
    dependencies[CORE.name] === CORE.version,
    `${label} must depend on ${CORE.name}@${CORE.version} exactly`,
  )
}

function lockPackage(lockfile: Lockfile, path: string): Manifest {
  assert(typeof lockfile.packages === "object" && lockfile.packages !== null, "lockfile packages are missing")
  const packages = lockfile.packages as Record<string, unknown>
  const manifest = packages[path]
  assert(typeof manifest === "object" && manifest !== null, `lockfile package ${path} is missing`)
  return manifest as Manifest
}

/** Validates release manifests and returns the required serial publication plan. */
export function createReleasePlan(manifests: ReleaseManifests): ReleasePackage[] {
  const plan = [CORE, PI, ROOT]

  assertManifest(manifests.root, ROOT)
  assertManifest(manifests.core, CORE)
  assertManifest(manifests.pi, PI)
  assertCoreDependency(manifests.root, "root manifest")
  assertCoreDependency(manifests.pi, "Pi manifest")

  const rootLock = lockPackage(manifests.lockfile, "")
  const coreLock = lockPackage(manifests.lockfile, CORE.workspace)
  const piLock = lockPackage(manifests.lockfile, PI.workspace)
  assertManifest(rootLock, ROOT)
  assertManifest(coreLock, CORE)
  assertManifest(piLock, PI)
  assertCoreDependency(rootLock, "root lock workspace")
  assertCoreDependency(piLock, "Pi lock workspace")

  return plan.map(({ name, version, workspace }) => ({ name, version, workspace }))
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"))
}

export function readReleasePlan(root = process.cwd()): ReleasePackage[] {
  return createReleasePlan({
    root: readJson(resolve(root, "package.json")) as Manifest,
    core: readJson(resolve(root, CORE.workspace, "package.json")) as Manifest,
    pi: readJson(resolve(root, PI.workspace, "package.json")) as Manifest,
    lockfile: readJson(resolve(root, "package-lock.json")) as Lockfile,
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(readReleasePlan()))
}
