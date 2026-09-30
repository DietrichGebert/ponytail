---
name: prisma-composer
metadata:
  library: "@prisma/composer"
  library_version: "0.16.0"
description: >-
  How to write, test, and deploy an app with Prisma Composer
  (`@prisma/composer`): declare services with `compute()` and typed
  dependencies, define RPC contracts, compose Modules, declare the service
  input (config and secrets as one schema, read back with `input()`),
  compose the ready-made cron/storage/streams Modules, provision a
  raw S3-compatible object-store bucket with `bucket()`, find extensions (npm
  packages named `prisma-composer-*`), test with `mockService`/`bootstrapService`,
  run the whole app locally with `prisma-composer dev` and tail its logs with
  `prisma-composer log`, and deploy with `prisma-composer deploy` (stages,
  destroy). Use when building a Prisma App, wiring a service dependency, adding
  a Postgres database, adding scheduled jobs / blob storage / event streams / a
  raw bucket, writing tests for composed services, running an app locally,
  reading its logs, or deploying/tearing down an environment. Triggers on
  "prisma composer", "@prisma/composer", "prisma app", "compute()",
  "service.load()", "module()", "contract()", "mockService",
  "bootstrapService", "prisma-composer dev", "prisma-composer log",
  "prisma-composer deploy", "--stage", "--fresh", "--tail",
  "prisma-composer destroy", "prisma-composer-", "bucket()".
---

# Writing apps with Prisma Composer

A **Prisma App** is a tree of **Modules** composed in TypeScript. The leaves
are **services** (`compute()`) and **resources** (`rawPostgres()`); the root
module wires them together by their typed ports. Your code receives everything
from exactly one place — the service node:

- `service.load()` — dependencies (typed RPC clients, database bindings)
- `service.input()` — the service's whole input, one schema-validated typed
  object; credentials in it are redacting `SecretString` boxes
- `service.port()` — the reserved port to bind (default 3000), typed; never
  `process.env`

The framework never bundles or transforms your code. You build your app with
whatever bundler you like (`bun build`, `next build`); `prisma-composer deploy`
assembles the built output and provisions it on Prisma Cloud (Compute + Prisma
Postgres).

Two things make building here fast and hard to get wrong — lean on both:

- **Compose before you write.** Reach for an existing Module (below) before
  implementing a capability yourself; wiring one in is a couple of lines.
- **The compiler checks the wiring.** A dependency wired to the wrong
  producer, a missing RPC handler, a config value of the wrong shape — all of
  it fails `tsc`, not the deploy. Typecheck, then build, then deploy; don't
  reach for the cloud to find out whether the app is correct.

Two packages, and only two, appear in your `package.json`:

| Package | Provides |
| --- | --- |
| `@prisma/composer` | Core authoring: `module`, `secret`, `isSecretString`, `/arktype` (the `secretString()` schema leaf), `/rpc`, `/node`, `/nextjs`, `/config`, `/testing`, the `prisma-composer` CLI |
| `@prisma/composer-prisma-cloud` | The Prisma Cloud target: `compute`, `postgres`, `envSecret`, `envParam`, `/control`, `/testing`, and the shared `/cron`, `/storage`, `/streams`, `/orm` modules |

## tsconfig and import specifiers

Within the entry graph (everything reachable from `module.ts`) relative
imports may use `./service.js` or extensionless `./service`. The CLI maps
`.js` and extensionless specifiers to the matching `.ts` source under Node;
Bun does this natively.

A minimal tsconfig:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Preserve",
    "moduleResolution": "bundler",
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun"]
  },
  "include": ["module.ts", "src"]
}
```

## Anatomy of a service

A service is four small files. Worked example: an `auth` service that owns a
Postgres database and serves an RPC contract, consumed by a `storefront`
Next.js app.

**The contract** lives with the service that owns it. Any Standard Schema
validator types the messages; arktype is the house choice:

```ts
// auth/src/contract.ts
import { contract, rpc } from '@prisma/composer/service-rpc';
import { type } from 'arktype';

export const authContract = contract({
  verify: rpc({ input: type({ token: 'string' }), output: type({ ok: 'boolean' }) }),
});
```

**The service declaration** is pure data — name, dependencies, build, exposed
ports. No behavior, no platform keys:

```ts
// auth/src/service.ts
import node from '@prisma/composer/node';
import { compute, postgres } from '@prisma/composer-prisma-cloud';
import { authContract } from './contract.ts';

export default compute({
  name: 'auth',
  deps: { db: rawPostgres() },
  build: node({ module: import.meta.url, entry: '../dist/server.mjs' }),
  expose: { rpc: authContract },
});
```

**The server entry** is what your build produces and the platform boots. It
reads its dependencies through `load()` and serves the contract with
`serve()` — the handler map is keyed by the expose port's name and is
exhaustive at compile time:

```ts
// auth/src/server.ts
import { serve } from '@prisma/composer/service-rpc';
import { SQL } from 'bun';
import service from './service.ts';

const { db } = service.load(); // { url } — you build your own client
const port = service.port();   // the reserved port, resolved (default 3000)

const sql = new SQL({ url: db.url, max: 1, idleTimeout: 10 });

const handler = serve(service, {
  rpc: {
    verify: async ({ token }) => ({ ok: token.length > 0 }),
  },
});
export default handler;

// Bind all interfaces — Compute routes external HTTP to the VM; a
// loopback-only listener is unreachable.
Bun.serve({ port, hostname: '0.0.0.0', fetch: handler });
```

**The consumer** declares the dependency as `rpc(contract)` and gets a typed
client back from `load()`:

```ts
// storefront/src/service.ts
import nextjs from '@prisma/composer/nextjs';
import { rpc } from '@prisma/composer/service-rpc';
import { compute } from '@prisma/composer-prisma-cloud';
import { authContract } from '@my-app/auth/contract';

export default compute({
  name: 'storefront',
  deps: { auth: rpc(authContract) },
  build: nextjs({ module: import.meta.url, appDir: '..' }),
});
```

```tsx
// storefront/app/page.tsx
import service from '../src/service.ts';

// load() reads the runtime environment, which doesn't exist at build time —
// render per request instead of prerendering.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const { auth } = service.load();
  const { ok } = await auth.verify({ token: 'demo-token' });
  return <p>Signed in: {String(ok)}</p>;
}
```

**Service-to-service calls are authenticated for you.** At deploy the
framework mints a distinct, unguessable **service key** per consumer→provider
binding: the consumer's client sends it on every call, and `serve()` returns
`401` to anything else *before* the handler runs. Nothing declares it — no key
in the contract, the service, the module, or the app's code.

Two rules follow for you specifically: **don't build your own
service-to-service auth** on top of this, and **don't tell a user to `curl` a
deployed `/rpc/<method>` to check it works** — an unwired caller always gets
`401`, which looks like a broken deploy and isn't. Debug through a consumer,
or locally.

**Calls carry an idempotency key and retry safely for you.** Every call the
generated client makes carries an `Idempotency-Key`; a call dropped while the
target cold-starts is retried with a backoff, and `serve()` runs one call per
key — a retry that arrives after the first completed replays that answer
instead of re-running the handler. So every method is safely retryable and no
contract declares anything about it (do not add an "is this idempotent" flag —
the framework does not have one). Two consequences for you: a handler may take
an **optional third argument** `(input, deps, ctx)` and read `ctx.idempotencyKey`
(`string | undefined` — it's absent for a keyless caller) if it needs exactly-once
beyond one instance's memory (most don't); and a request without the header is
served once without deduplication rather than rejected, so a hand-rolled probe
works but gets no retry safety.

| | |
| --- | --- |
| Locally / in tests | nothing is provisioned, so `serve()` passes every call through — never supply a key in `inputs` |
| Per binding | two consumers of one provider hold different keys, so one leaking can't impersonate the other |
| Scope | service-level — any valid key reaches every method that service exposes; split into two services to gate separately |
| Rotation | remove the binding (or destroy the stack) and redeploy — a plain redeploy is a no-op, not a rotation |
| Storage | `COMPOSER_*` variables the deploy owns and rewrites; never hand-edit one |

It's a capability token ("I'm a service this app wired to you"), not a secret,
and its value lives in deploy state — deliberately unlike `secret()`, whose
value the framework never holds. `docs/design/90-decisions/ADR-0030…` in the
prisma/composer repo carries the reasoning.

## The root module

The root module provisions the pieces and wires exposed ports into dependency
slots. It is the app — `prisma-composer deploy` loads its default export:

```ts
// module.ts
import { module } from '@prisma/composer';
import authModule from '@my-app/auth';
import storefrontService from '@my-app/storefront';

export default module('my-app', ({ provision }) => {
  const auth = provision(authModule);
  provision(storefrontService, { deps: { auth: auth.rpc } });
});
```

`provision(node, opts?)` accepts `id` (defaults to the node's own name),
`deps` (wire each declared dependency to a provisioned ref or exposed port),
`input` (the service's input binding — required exactly when it declares an
input schema, see § Service input), and `secrets` (bind a module boundary's
forwarded secret needs).

## Builds are yours

The framework assembles only what you built — users build, the framework
assembles. For a plain server process, `entry` must point at a single
self-contained ESM file: everything inlined except runtime built-ins (`bun`,
`bun:*`, `node:*`), which the deploy VM provides. Deploy copies that one file
and never ships `node_modules`, so anything left un-inlined fails at boot. Any
bundler that produces such a file works. With bun:

```sh
bun build src/server.ts --target=bun --outfile dist/server.mjs
```

Two services in one package means two separate builds, one per entry — not one
multi-entry build, which would split shared code into a chunk neither output
contains.

If the build emits a directory rather than one file — a server plus the client
bundle, CSS and images it serves, as Bun's HTML import produces — name the
directory with `dir` and the booting file inside it with `entry`:

```ts
build: node({ module: import.meta.url, dir: '../dist/server', entry: 'server.js' })
```

`dir` resolves relative to the service module; `entry` resolves inside `dir`
and may be nested. Deploy copies the tree verbatim and boots the named file,
so the server must resolve its siblings against `import.meta.url`, not the
working directory. Nothing is inferred, and two rules bite: the tree must
contain no symlinks (the packager rejects them — assembly fails and names the
link), and `entry` must be a file inside `dir` (`../` is an error, not an
escape). Omit `dir` for the single-file form.

For Next.js, `next build` with `output: 'standalone'` is the whole build;
`nextjs({ module, appDir })` tells the deploy where the app root is.

Always build before deploying — `prisma-composer deploy` does not build for
you.

## Deploy config

`prisma-composer.config.ts` usually sits next to `module.ts`, but it may live in
any ancestor directory: the CLI searches the entry's directory first, then each
parent, and uses the nearest one. It is read only by `prisma-composer
deploy`/`destroy`, never imported by app code. A plain-JavaScript project can
name it `prisma-composer.config.mjs` or `.js` to keep it out of its TypeScript
build (a build with `allowJs` still needs an explicit `exclude`); `.mts` is the
TypeScript ES-module spelling. Within one directory `.ts` wins, then `.mts`,
`.mjs`, `.js`:

```ts
// prisma-composer.config.ts
import { defineConfig } from '@prisma/composer/config';
import { nodeBuild } from '@prisma/composer/node/control';
import { prismaCloud, prismaState } from '@prisma/composer-prisma-cloud/control';

export default defineConfig({
  extensions: [prismaCloud(), nodeBuild()],
  state: () => prismaState(), // deploy state, in its own database on the stage's branch
});
```

Add `nextjsBuild()` from `@prisma/composer/nextjs/control` to `extensions`
when the app contains a Next.js service.

## Databases

Two kinds of Postgres dependency:

**`rawPostgres()`** — the binding is `{ url }` and the app owns its client.
Construct it in your server entry, as in the auth example above.

**`postgres(...)`** — a Prisma-ORM-typed database: `load()`
returns the typed client the framework constructs from your data contract, so
queries like `db.orm.public.Product.all()` are compile-time checked. The
contract is emitted from `contract.prisma` by `prisma contract emit` and
wrapped once, referenced by both ends:

```ts
// src/data.ts — the ONE value both ends reference
import { dataContract } from '@prisma/composer-prisma-cloud/orm';
import type { Contract } from '../contract.d.ts';
import contractJson from '../contract.json' with { type: 'json' };

export const catalogData = dataContract<Contract>(contractJson);
```

The dependency end is `deps: { db: postgres(catalogData) }`. The resource
end (inside the module that owns the database) also names the
`prisma.config.ts` path, which the deploy's migration step loads to find
`migrations/` — committed migrations are replayed at deploy, before the
service starts:

```ts
const db = provision(
  postgres({ name: 'database', contract: catalogData, config: './prisma.config.ts' }),
);
```

(`postgres` is both ends: the contract alone is the dependency end; the
options object is the resource end.)

The deploy is replay-only: it applies the migrations committed under
`migrations/` and never creates schema itself. Every schema change (including
the very first schema of a new database) follows the same loop:

1. Edit `contract.prisma`.
2. `prisma contract emit` — regenerates `contract.json` + `contract.d.ts`.
3. `prisma migration plan --name <slug>` — authors the migration into
   `migrations/` (on an empty graph this authors the baseline,
   empty → your schema).
4. Commit `migrations/` with the change, then deploy. A fresh database
   replays the whole path from empty.

If no authored path reaches the target contract, the deploy (and
`prisma-composer dev` against a stale local database) refuses with
`MIGRATION_PATH_NOT_FOUND` and names the exits: author the missing migration
as above, or — when iterating against a local database only — bring it along
directly with `prisma db update`. Never skip step 3 before a deploy.

See `examples/store/modules/catalog` in the prisma/composer repo for the
complete pattern.

## Object Storage

`bucket` is a raw S3-compatible object-store bucket, imported alongside `postgres`:

```ts
import { bucket, compute } from '@prisma/composer-prisma-cloud';

// service.ts — dependency end: receives { url, bucket, accessKeyId, secretAccessKey }
export default compute({ name: 'uploads', deps: { store: bucket() } });

// module.ts — resource end: provisions the bucket and mints a keypair
const store = provision(bucket({ name: 'uploads' }));
provision(uploadsService, { deps: { store } });
```

Use any S3-compatible client with the binding: the shape matches the standard S3
config and is also compatible with the `s3()` dependency from `/storage`, so any
service wired to `s3()` can be rewired to a `bucket` resource without changing
the service declaration.

## Reusable Modules

A Module is the unit of reuse: it owns its internals (its database, its
services) and exposes only typed ports. Declare the boundary in the second
argument; wire internals in the builder; return the exposed ports:

```ts
// auth/src/module.ts — a Module that owns its own Postgres
import { module, secret } from '@prisma/composer';
import { postgres } from '@prisma/composer-prisma-cloud';
import { authContract } from './contract.ts';
import authService from './service.ts';

export default module(
  'auth',
  { secrets: { signingKey: secret() }, expose: { rpc: authContract } },
  ({ secrets, provision }) => {
    const db = provision(rawPostgres({ name: 'database' }));
    const service = provision(authService, {
      id: 'service',
      deps: { db },
      input: { signingKey: secrets.signingKey }, // forwarded ref as a binding leaf
    });
    return { rpc: service.rpc };
  },
);
```

Naming rules that bite: a provision id shorter than 3 characters is rejected
by the platform (name the database `'database'`, not `'db'`), and a service
whose name equals its enclosing module's reads as `auth.auth` unless you give
it an explicit `id`.

A module can also declare boundary `deps` — inputs the parent wires exactly as
it would wire a service's. The consumer never sees the module's internals.

### The building blocks you can compose

Modules are the building blocks: provision one, wire its exposed port, and
you're done — you never reimplement what a Module already owns. The
first-party set ships inside `@prisma/composer-prisma-cloud`. It's small, and
growing:

| Import | What it provisions | Exposes |
| --- | --- | --- |
| `cron` from `/cron` | An always-on scheduler firing your schedule at your runner service | nothing |
| `storage` from `/storage` | An S3-backed blob store (own Postgres + minted credentials) | `store` |
| `streams` from `/streams` | Durable append-only event streams over a `store` | `streams` |

**Finding more.** A Composer extension — a package that brings its own
Modules, resources, or deploy target — is published on npm under the name
`prisma-composer-*`. That name is the convention, so it's how you look for
one. The ecosystem is new: today the blocks above plus the app Modules you
write are the whole set, so don't reach for a `prisma-composer-*` package
without checking that it actually exists on npm first.

Cron end to end — the schedule is one source of truth; `serveSchedule` is
exhaustive over its job ids at compile time:

```ts
// service.ts
import { defineSchedule, triggerContract } from '@prisma/composer-prisma-cloud/cron';
export const schedule = defineSchedule({ tick: '60s' });
// the runner service exposes { trigger: triggerContract }

// server.ts
import { serveSchedule } from '@prisma/composer-prisma-cloud/cron';
const handler = serveSchedule(service, schedule, {
  tick: (deps) => deps.worker.tick({}),
});

// module.ts — the cron module's boundary deps mirror the runner's own
provision(cron({ schedule, runner: runnerService }), { deps: { worker: worker.rpc } });
```

## Service input

Choosing the channel is most of the decision:

| The value is… | Declare | Provide | Read |
| --- | --- | --- | --- |
| produced by another node | `deps: { db: rawPostgres() }` | wire at `provision()` | `load()` |
| anything else — config or credential | one field of the `input` schema | bind at `provision()`: literal, `envParam()`, or `envSecret()` | `input()` |

The service declares its whole incoming configuration — plain values and
credentials together — as **one
[Standard Schema](https://standardschema.dev)** (arktype is the house
choice). A credential is a field typed as the redacting `SecretString` box;
conditional legality ("no stripe key unless billing is on") is an ordinary
schema union:

```ts
// service.ts — the shapes that are legal
import { secretString } from '@prisma/composer/arktype';
import { type } from 'arktype';

compute({
  name: 'scheduler',
  input: type({
    jobs: type({ jobId: 'string', every: 'string' }).array(),
    'region?': 'string',
    apiKey: secretString(),
  }),
  // ...
});

// module.ts — where each value comes from; the binding mirrors the schema's shape
import { envParam, envSecret } from '@prisma/composer-prisma-cloud';
provision(scheduler, {
  input: {
    jobs: [{ jobId: 'tick', every: '60s' }],   // a literal
    region: envParam('REGION'),                 // a per-stage platform variable
    apiKey: envSecret('SCHEDULER_API_KEY'),     // a credential — name only, never the value
  },
});

// server.ts — one call, one validated typed object
const input = service.input();
input.apiKey.expose(); // the only way to a secret's value; the box redacts everywhere else
```

Rules that bite:

- **Secretness is enforced by validation**: a literal bound where the schema
  expects `SecretString` fails the deploy, and `envSecret` bound to a plain
  string field fails the same way. Don't put credentials in plain fields.
- **`envParam` values arrive as raw strings** — bind them to string fields.
  The stage's platform variable is the store; the deploying shell only seeds
  it (preflight copies a missing name up from the shell, and fails early,
  naming the variable, when both lack it). Changing the platform value needs
  a redeploy.
- **Absence is the schema's call**: an env-bound field whose variable is
  unset (or empty) resolves to *key omitted* — legal only if the schema says
  so (optional field, union arm). The deploy report prints the serialized
  input document (secret-free: secrets ride as `{"$secret":"VAR"}` pointers)
  and every key that resolved absent.
- **The reserved `port` (default 3000) is outside the schema** — read it
  through `service.port()` (a sibling of `service.origin()`), never
  `process.env`. The framework also exports `PORT` for Next.js standalone,
  which binds it itself.
- A module forwards a secret need without learning the platform name
  (the auth Module above); the forwarded ref is a binding leaf.

`examples/env-param` and `examples/storefront-auth` in the prisma/composer
repo are the working versions.

## Testing

You test by deciding what `load()` gives the code, never by editing the code
under test:

| You want to… | Use | From |
| --- | --- | --- |
| Test a page / action / handler in isolation | `mockService` | `@prisma/composer/testing` |
| Run the real boot + request path against a fake dependency | `bootstrapService` | `@prisma/composer-prisma-cloud/testing` |

**Unit — `mockService`.** Returns a copy of the service whose `load()` yields
your doubles (type-checked against the declared deps) and whose `input()`
yields the object you pass under the reserved `input` key, in one flat
object (required exactly when the service declares an input schema; handed
over as-is, not validated). Wiring the module substitution is your runner's
job (`vi.mock` in Vitest, `mock.module` in bun test):

```tsx
// page.test.tsx
import { mockService } from '@prisma/composer/testing';
import realService from '../src/service.ts';

vi.mock('../src/service.ts', () => ({
  default: mockService(realService, {
    auth: { verify: async () => ({ ok: true }) }, // wrong shape = compile error
  }),
}));

import Page from './page.tsx';
expect(renderToString(await Page())).toContain('Signed in: true');
```

**Integration — `bootstrapService`.** Boots the service's real built entry
in-process against a config you choose, exactly as a deployed boot would;
drive it over real HTTP. Run under `bun test`:

```ts
import { bootstrapService } from '@prisma/composer-prisma-cloud/testing';
import fakeAuth from '@my-app/auth/fake'; // in-memory handler, no db
import storefront from '../src/service.ts';

const fake = Bun.serve({ port: 0, fetch: fakeAuth });

const app = await bootstrapService(storefront, {
  service: { port: 4310 },
  inputs: { auth: { url: fake.url.href } },
});

const res = await app.fetch(new Request(app.url));
```

- **`service.port` must be concrete** — the entry self-listens; no OS-assigned
  port is reported back.
- **No `close()`** — run each integration-test file in its own process (bun
  test does).
- **Next.js services take a third argument**, a boot thunk, because the built
  entry lives in Next's standalone output — resolve it with
  `standaloneServerPath` from `@prisma/composer/nextjs/control`.
  `bootstrapService` exports the resolved port as `process.env.PORT` before
  booting, which is what Next's standalone server binds.
- **A service with an input schema takes `input`** in the config — a binding
  exactly like `provision()`'s, run through the real serialize/read path, so
  `input()` in the booted entry sees what a deploy would produce.

**The fake you pass.** A dependency's type is its contract, so any value of
that shape is a valid double: a bare object (fastest), the real client over an
in-memory handler, or a real local server (what `bootstrapService` drives).
Ship a dependency's fake from its own package as a `/fake` entry point,
outside `src/`, so the fake and the real service always share one contract.

## Running locally

`prisma-composer dev module.ts` runs the whole app on this machine — every
service, its Postgres and buckets, wired as they deploy — with **no cloud
credentials** (no `PRISMA_*`). It runs the same pipeline as deploy against
local emulators, so build first, exactly like deploy:

```sh
turbo run build && prisma-composer dev module.ts
```

It prints each service's local URL (the "front door"), watches built output
and restarts a service when its build changes, and runs until Ctrl-C. Ctrl-C
stops the app's processes but leaves the local databases, buckets, and their
data up, so the next `dev` is a warm start; `--fresh` wipes this app's local
instances and data first.

`dev` does **not** print service logs — that would bury the front door once
several services run. Logs are their own command:

| You want to… | Run |
| --- | --- |
| Run the app locally | `prisma-composer dev module.ts` |
| Start clean (wipe local data) | `prisma-composer dev module.ts --fresh` |
| Tail every service's logs | `prisma-composer log module.ts` |
| Tail one service | `prisma-composer log module.ts <address>` |
| Show more history first | `prisma-composer log module.ts --tail <n>` |

`prisma-composer log` follows the merged logs of the already-running app, each
line prefixed with its service (`[catalog.service] …`); pass a dotted address
to narrow to one. It only reads — it never builds, provisions, starts, or
stops anything. `--tail <n>` sets how much recent history to show before live
output (default 20; `0` for live-only). An unset secret doesn't block a local
run: it becomes a placeholder plus a warning, and only the code path that
spends it fails, at the real external service it calls. Windows isn't
supported yet.

## Deploying

Requires exactly two environment variables: `PRISMA_SERVICE_TOKEN` and
`PRISMA_WORKSPACE_ID`. The target environment — a **stage** — is chosen on the
command line, never in code:

| You want to… | Run |
| --- | --- |
| Deploy to production | `prisma-composer deploy module.ts` |
| Deploy an isolated environment | `prisma-composer deploy module.ts --stage <name>` |
| Override the app name for one run | `prisma-composer deploy module.ts --name demo-42` |
| Tear down an isolated environment | `prisma-composer destroy module.ts --stage <name>` |
| Tear down production's resources | `prisma-composer destroy module.ts --production` |

A Prisma App is one Project; a stage is a Branch of it — its
own compute, its own empty database, its own configuration. Deploys are
idempotent: re-deploying a stage updates the resources inside it. A stage name
must be a valid git ref name; an invalid name is a hard error.

Destroy always requires an explicit target — a bare `prisma-composer destroy`
is an error, and `--stage` with `--production` is too. Destroying a stage
deletes its Branch after removing its resources; the production Branch itself
is never deleted, only the resources inside it. Destroying production also
deletes the Project itself once it's empty, so hand-run stacks don't leave
behind empty Projects — but a Project still holding another stage's resources
is kept. Destroy never creates anything: destroying a never-deployed stage
fails rather than standing one up.

```sh
turbo run build && prisma-composer deploy module.ts --stage pr-42
```

### What a deploy prints

A deploy ends by printing the app's own topology — authored names, the
platform resource each became, and public URLs. The tree is the module
structure (`auth.api` is the `api` service inside the `auth` module):

```
storefront-auth
├─ auth
│  └─ api   compute-service cps_abc123
│           https://xyz.ewr.prisma.build
├─ db       postgres-database db_def456
└─ web      compute-service cps_ghi789
            https://uvw.ewr.prisma.build
```

Read ids out of this rather than telling the user to go hunting in the
Console. A URL appears only where the address is genuinely public — a compute
service prints one, a database never does (it has a connection string, not a
public endpoint), and a node whose product is secret material (an
`s3-credentials` keypair) reports no resource line at all. A node that
published nothing reportable still appears, marked `(no entities reported)`.

Older deploys ended with a raw `{ outputs: {} }` blob from the deploy engine —
always empty, never about the app. It is gone; nothing configured it and
nothing consumed it.

### The connection contract is checked at deploy

A connection declares the values it needs by name, and the producer on the
other end must supply them. A producer that omits one fails the deploy, naming
the edge, the param, and what the producer did supply:

```
Connection input "auth.db" declares param "url", but its producer "db" did not
supply it — the producer's outputs carry [host].
```

Fix it at whichever end is wrong: add the name to the outputs the producer
returns from its lowering, or mark the param `optional` on the connection if absent is
genuinely legal (the consumer then reads `undefined`).

This is a deploy-time refusal, not a broken deploy — and it can appear on an
app whose code didn't change. The gap used to pass silently: the value reached
the consumer as `undefined`, went into its environment, and crashed *that*
service at boot, blaming the reader instead of the supplier. Don't route around
it by making the param optional unless absent really is valid; that reinstates
the silent `undefined`.

Only reachable if you authored the connection or the extension on one side —
every shipped block supplies what it declares.

### Driving deploys from code

`@prisma/composer/control` exposes the CLI's operations in-process: typed
`deploy`, `destroy`, `dev`, and `log` returning structured results — no argv,
no CLI rendering, no exit codes (the spawned deploy engine's own inherited
output can still reach the host terminal). The CLI itself is a renderer over
them.

```ts
import { deploy } from '@prisma/composer/control';
const result = await deploy({ entry: 'module.ts', stage: 'pr-42' });
// result: { ok: true, value: { summary? } } | { ok: false, failure }
```

- Failures come back as `{ ok: false, failure }` where `failure` is a
  structured error: branch on its dotted `failure.code` (e.g.
  `ASSEMBLE.BUILD_FAILED`, `DEPLOY.ENGINE_FAILED` — ADR-0044's closed
  registry), with the same fix-naming `message`/`why`/`fix` the CLI renders.
  An engine failure's `meta.diagnostics` (exit code, reproduce command; read
  it with the exported `executionDiagnostics(failure)`) describes the current
  execution mechanism — branch on `code`/`message`/`cause` for anything
  durable. The effect version conflict is `DEPS.EFFECT_VERSION_CONFLICT`, and
  importing the module executes nothing until an operation runs. A
  non-structured rejection out of an operation is a bug in composer, not an
  expected failure.
- `destroy` takes `target: { kind: 'production' } | { kind: 'stage', stage }`
  — explicit, never defaulted.
- `deploy`'s `summary` (the deployed topology) is best-effort; `undefined` on
  a successful deploy is normal.
- The deploy engine's live output still streams to the host process's stdio —
  the current mechanism; the operations don't capture it.
- `dev` resolves to `{ ok: true, value: session }` or a failure; the
  session is `{ endpoints, stop(), closed }` with progress via `onEvent`, and
  the host owns signal handling. `log` resolves to
  `{ ok: true, value: { appName, services, lines } }` or a failure, where
  `lines` is an `AsyncIterable` ended by a caller-owned `AbortSignal` (or by
  the consumer stopping early); zero running services is a valid result, not
  an error.

## Production pitfalls

- **Scale-to-zero closes idle database connections.** A persistent client
  crashes into a 502 restart loop unless you keep the pool small and
  reconnect-friendly (`new SQL({ url, max: 1, idleTimeout: 10 })` for Bun) and
  log `uncaughtException`/`unhandledRejection` instead of dying.
- **Bind `0.0.0.0`**, not loopback — Compute routes external HTTP to the VM.
- **Next.js pages that call `load()` need `export const dynamic =
  'force-dynamic'`** — the runtime environment doesn't exist at build time,
  and Next ignores runtime env for prerendered routes.
- **A deployed `/rpc/<method>` returns `401` to anything but a wired peer.**
  Every RPC binding carries an auto-provisioned service key, so a hand-rolled
  `curl` is never authorized, and a provider with no wired consumers rejects
  everything. Not a broken deploy — reach it through a consumer, or run it
  locally where nothing is enforced.
- **Cold starts reset service-to-service connections.** A call into a
  scaled-to-zero service can get `ECONNRESET`; retry it.
- **Every `prisma-composer` command stops at start-up on an `effect` version
  conflict** (`Dependency conflict: alchemy resolves effect@...`). Another
  dependency floated a newer `effect` and the package manager hoisted it over
  Composer's pin. Do what the error says: pin the whole `effect`
  constellation in the app's `package.json` `overrides` (yarn: `resolutions`;
  pnpm: `pnpm.overrides`) — `effect` plus `@effect/sql-d1`, `@effect/sql-pg`,
  `@effect/vitest`, and `@effect/platform-bun`/`-node`/`-node-shared`, all at
  Composer's exact pin — and reinstall. (A workaround for an upstream alchemy
  bug: its own effect-family ranges float past what its code supports. The
  repo's examples carry the block.)
- **The ingress buffers streaming responses.** An open SSE tail delivers
  nothing and times out at 60s — don't build on streamed HTTP responses.

## What Composer doesn't do yet

Name the gap instead of inventing an API:

- **No interactive auth.** Deploys authenticate only via a static
  `PRISMA_SERVICE_TOKEN`; there is no `login` flow.
- **No in-memory contract bindings.** A dependency can't yet be wired to a
  co-located handler without HTTP; use `bootstrapService` with a loopback
  fake.
- **RPC over HTTP is the only contract kind.** No gRPC, WebSocket, or
  streaming contracts.

For anything else missing, check the examples and design docs in the
prisma/composer repo (`examples/`, `docs/design/10-domains/`,
`docs/design/90-decisions/`), then file an issue there rather than guessing.
