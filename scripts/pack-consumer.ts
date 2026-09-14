import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

interface PackedFile {
  path: string
}

interface PackedArchive {
  filename: string
  files: PackedFile[]
}

const PI_RUNTIME_MODULES = [
  "catalog",
  "context",
  "extension",
  "oauth",
  "provider",
  "response",
  "stream",
  "tool-contract",
  "tool-context",
  "tool-schema",
] as const

const ROOT = process.cwd()
const CORE_NAME = "@benjamolina/antigravity-guard-core"
const ROOT_NAME = "@benjamolina/opencode-antigravity-guard"
const PI_NAME = "@benjamolina/pi-antigravity-guard"

function run(command: string, args: string[], cwd = ROOT): string {
  const npmCli = process.env.npm_execpath
  const isNpm = command === "npm"
  if (isNpm && !npmCli) {
    throw new Error("npm_execpath is required to run npm from the pack harness")
  }
  const executable = isNpm || command === "node" ? process.execPath : process.platform === "win32" ? `${command}.cmd` : command
  const commandArgs = isNpm ? [npmCli!, ...args] : args

  return execFileSync(executable, commandArgs, {
    cwd,
    encoding: "utf8",
    shell: !isNpm && command !== "node" && process.platform === "win32",
    stdio: ["ignore", "pipe", "inherit"],
  })
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function pack(workspace: string | undefined, destination: string): PackedArchive {
  const args = ["pack", "--json", `--pack-destination=${destination}`]
  if (workspace) {
    args.push(`--workspace=${workspace}`)
  }
  const output = run("npm", args)
  const json = output.match(/(\[\s*\{[\s\S]*\]\s*)$/)?.[1]
  assert(json, `npm pack did not return JSON for ${workspace ?? "the root package"}`)
  const archive = JSON.parse(json) as PackedArchive[]
  const result = archive[0]
  assert(result, `npm pack did not produce an archive for ${workspace}`)
  return result
}

function archivePath(destination: string, archive: PackedArchive): string {
  return join(destination, archive.filename)
}

function assertPackagedFile(archive: PackedArchive, filename: string): void {
  assert(archive.files.some((file) => file.path === filename), `${archive.filename} omits ${filename}`)
}

export function assertPiArchiveContents(archive: PackedArchive): void {
  for (const module of PI_RUNTIME_MODULES) assertPackagedFile(archive, `dist/${module}.js`)
  assert(!archive.files.some((file) => file.path.startsWith("src/")), "Pi archive contains source files")
  assert(!archive.files.some((file) => /(?:^|\/)(?:fixtures|test)(?:\/|$)|\.test\.(?:js|d\.ts|d\.ts\.map)$/.test(file.path)), "Pi archive contains test or fixture artifacts")
}

function assertNoRepositoryImportsInEmittedFiles(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      assertNoRepositoryImportsInEmittedFiles(path)
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts") || entry.name.endsWith(".d.ts.map")) {
      const source = readFileSync(path, "utf8")
      assert(!source.includes("../../packages/"), `${path} has a repository-relative package import`)
      assert(!source.includes("../packages/"), `${path} has a repository-relative package import`)
    }
  }
}

function installArchive(consumer: string, archive: string): void {
  run("npm", ["install", "--ignore-scripts", "--omit=dev", archive], consumer)
}

function main(): void {
  const temp = mkdtempSync(join(tmpdir(), "antigravity-guard-pack-"))

  try {
    run("npm", ["run", "build:all"])

    const core = pack(CORE_NAME, temp)
    const root = pack(undefined, temp)
    const pi = pack(PI_NAME, temp)

    assertPackagedFile(core, "LICENSE")
    assertPackagedFile(core, "dist/index.js")
    assertPackagedFile(core, "dist/index.d.ts")
    assertPackagedFile(root, "dist/index.js")
    assertPackagedFile(root, "dist/index.d.ts")
    assertPackagedFile(pi, "LICENSE")
    assertPackagedFile(pi, "package.json")
    assertPackagedFile(pi, "README.md")
    assertPiArchiveContents(pi)

    assertNoRepositoryImportsInEmittedFiles(join(ROOT, "packages", "core", "dist"))
    assertNoRepositoryImportsInEmittedFiles(join(ROOT, "packages", "pi", "dist"))
    assertNoRepositoryImportsInEmittedFiles(join(ROOT, "dist"))

    const rootConsumer = join(temp, "root-consumer")
    const piConsumer = join(temp, "pi-consumer")
    mkdirSync(rootConsumer)
    mkdirSync(piConsumer)
    run("npm", ["init", "--yes"], rootConsumer)
    run("npm", ["init", "--yes"], piConsumer)

    installArchive(rootConsumer, archivePath(temp, core))
    installArchive(rootConsumer, archivePath(temp, root))
    run("npm", [
      "exec",
      "--yes",
      "--package=node@20.19.5",
      "--",
      "node",
      "--input-type=module",
      "--eval",
      `await Promise.all([import(${JSON.stringify(CORE_NAME)}), import(${JSON.stringify(ROOT_NAME)})])`,
    ], rootConsumer)

    installArchive(piConsumer, archivePath(temp, core))
    run("npm", [
      "install",
      "--ignore-scripts",
      "--omit=dev",
      "@earendil-works/pi-ai@0.85.1",
      "@earendil-works/pi-coding-agent@0.85.1",
    ], piConsumer)
    run("npm", ["install", "--ignore-scripts", "--omit=dev", "--legacy-peer-deps", archivePath(temp, pi)], piConsumer)

    assert(existsSync(join(piConsumer, "node_modules", "@benjamolina", "pi-antigravity-guard")), "Pi archive did not install")
    run("node", ["--input-type=module", "--eval", `
      import { createRequire } from "node:module"
      import { existsSync } from "node:fs"
      import { dirname, join } from "node:path"
      import { pathToFileURL } from "node:url"
      const require = createRequire(import.meta.url)
      const manifest = require.resolve("@benjamolina/pi-antigravity-guard/package.json")
      const packageDirectory = dirname(manifest)
      for (const peer of ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent"]) {
        const peerPath = join(process.cwd(), "node_modules", ...peer.split("/"))
        if (!existsSync(join(peerPath, "package.json"))) throw new Error("Clean Pi consumer is missing peer " + peer)
        if (existsSync(join(packageDirectory, "node_modules", ...peer.split("/"), "package.json"))) {
          throw new Error("Packed Pi archive duplicated peer " + peer)
        }
      }
      const extension = manifest.replace(/package\\.json$/, "dist/extension.js")
      const loader = pathToFileURL(join(dirname(manifest), "..", "..", "@earendil-works", "pi-coding-agent", "dist", "core", "extensions", "loader.js")).href
      const { loadExtensions } = await import(loader)
      const loaded = await loadExtensions([extension], process.cwd())
      if (loaded.extensions.length !== 1) throw new Error("Packed Pi extension did not load: " + JSON.stringify(loaded.errors))
    `], piConsumer)
    console.log("Packed root/core Node 20 and Pi Node 22 consumer checks passed")
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

if (process.argv[1]?.endsWith("pack-consumer.ts")) main()
