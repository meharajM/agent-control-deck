# Bootstrap Commands

## 1. Prerequisites

- Node.js 24 LTS
- Corepack
- Git
- Xcode for iOS
- Android Studio/JDK for Android

## 2. Create workspace

```bash
mkdir agent-deck && cd agent-deck
git init
corepack enable
pnpm init
```

Set root `package.json`:

```json
{
  "name": "agent-deck",
  "private": true,
  "packageManager": "pnpm@10",
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
  - services/*
```

Create `.npmrc`:

```ini
node-linker=hoisted
strict-peer-dependencies=true
save-exact=true
```

## 3. Create mobile app

```bash
mkdir -p apps
npx create-expo-app@latest apps/mobile --template default@sdk-56
cd apps/mobile
npx expo install expo-dev-client expo-router expo-sqlite expo-secure-store \
  expo-local-authentication expo-camera expo-network
pnpm add zustand zod
cd ../..
```

## 4. Create bridge

```bash
mkdir -p apps/bridge/src
cd apps/bridge
pnpm init
pnpm add fastify ws better-sqlite3 zod ajv pino
pnpm add -D typescript tsx vitest @types/node @types/ws @types/better-sqlite3
cd ../..
```

## 5. Shared packages

```bash
mkdir -p packages/{protocol,adapter-contract,adapter-fake,bridge-database,crypto}
```

Each package uses TypeScript strict mode and explicit exports.

## 6. Tooling

```bash
pnpm add -Dw turbo typescript vitest eslint prettier
```

## 7. First validation

```bash
pnpm install --frozen-lockfile=false
pnpm typecheck
pnpm test
pnpm --filter @agent-deck/mobile expo doctor
```

## 8. Native development builds

```bash
cd apps/mobile
npx expo prebuild --clean
npx expo run:android
npx expo run:ios
```

Use development builds as the normal mobile workflow.
