# npm installation acceptance (#111)

## Reproduction

On Node 20.19.4 / npm 10.8.2, a fresh manifest containing only Core 9.1.3 and
NativeScript-Vue 3.1.2 installs published router beta.13 successfully. Installing
published beta.14 instead fails in Arborist's `#loadPeerSet` with
`Cannot read properties of null (reading 'edgesOut')`.

Beta.14 introduced the optional Vite peer. Removing Vite and webpack from the
router's peer metadata restores the normal install; the compiler remains an
optional peer and neither bundler becomes a router runtime dependency. The
webpack plugin checks the supplied compiler's version; the Vite plugin checks
the active host's `meta.viteVersion`, without importing a second Vite instance.

## Packed beta.15 checks

`scripts/check-install.mjs` installs the actual `npm pack` artifact into temporary
NativeScript projects, runs `npm ci` and `npm ls`, and exercises the installed
file-routing plugin with the selected bundler. Each fixture starts without
`node_modules`. The basic case also verifies that Vite was not installed.
NativeScript-Vue itself can bring webpack through its `vue-loader` peer.

| Node    | npm     | Basic app | NativeScript webpack | NativeScript Vite            |
| ------- | ------- | --------- | -------------------- | ---------------------------- |
| 20.19.4 | 10.8.2  | Passed    | Passed               | Passed with example lockfile |
| 22.23.3 | 10.8.2  | Passed    | Passed               | Passed with example lockfile |
| 22.23.3 | 11.21.1 | Passed    | Passed               | Passed without a lockfile    |

Local acceptance ran on 2026-10-21 with Core 9.1.3, NativeScript-Vue 3.1.2,
webpack 5.112.0 / `@nativescript/webpack` 5.0.38, and Vite 8.3.4 /
`@nativescript/vite` 8.0.20. All nine combinations passed. The same matrix runs
in CI against the packed package, with installation logs uploaded per job.
Local logs are under `/tmp/router-npm111/beta15-node*-npm*`.

The router suite passed 519 tests with 10 existing skips. Version diagnostics
cover unsupported/missing Vite and webpack hosts; real plugin tests still build
and generate routes. Types and the documentation build also passed.

## Independent npm 10 / NativeScript Vite boundary

A lockfile-free manifest with NativeScript Vite 8.0.20 and its Vue compiler
dependencies also triggers `edgesOut` on npm 10.8.2 **without any router package**.
Its resolver traverses optional Angular peers and their testing dependencies.
This is not fixed by removing the router's bundler peers.

The npm 10 Vite fixture therefore starts with the repository example's existing
dependency lockfile, installs the candidate router, and verifies a clean reinstall
and actual Vite plugin configuration. npm 11 additionally covers creation of that
NativeScript Vite dependency tree from scratch. No `--legacy-peer-deps`, `--force`,
dependency patches or fake registry packages are used. The fixture reports this
difference explicitly rather than counting lockfile-free npm 10 setup as a pass.

These are package-manager and build-plugin checks, not native-device tests. The
required native-contract suite remains responsible for device navigation/HMR.

## Reproduce a packed or published version

Use the desired Node/npm versions, then run from the repository root:

```sh
npm pack --pack-destination /tmp
node scripts/check-install.mjs /tmp/vue-router-ns-0.1.0-beta.15.tgz

# After publication, exercise the registry package with exactly the same checks:
node scripts/check-install.mjs vue-router-ns@0.1.0-beta.15
```

`NPM_CLI=/absolute/path/to/npm/bin/npm-cli.js` selects another npm installation
under the current Node executable. `INSTALL_REPORTS=/path/to/logs` keeps reports
at a predictable location; otherwise the runner prints its temporary log folder.
