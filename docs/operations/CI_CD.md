# CI and CD Plan

## 1. Goals

- Every contributor can validate protocol and bridge changes without runtime credentials.
- Native builds are reproducible from the lockfile.
- Real-runtime tests are isolated and opt-in.
- Local-only operation is tested with external network access blocked.

## 2. Pull-request jobs

### Linux fast lane

- Install Node 24 and pinned pnpm
- Lockfile-frozen install
- Formatting and lint
- TypeScript checks
- Unit tests
- JSON Schema validation
- SQLite migration test
- Fake-adapter contract suite
- UCP replay/idempotency property tests
- Build all TypeScript packages

### Android compile lane

- Generate native project through Expo CNG
- Compile debug Android app
- Run mobile component tests
- Run one Maestro fake-adapter flow on emulator for trusted branches

### macOS compile lane

- Generate iOS project
- Use an Xcode image that provides Swift `6.2` or newer for the current Expo SDK 56 dependency graph
- Compile iOS simulator app
- Run one Maestro fake-adapter flow on simulator for trusted branches

### Windows lane

- Bridge test suite
- Build bridge distribution folder
- Start bundled-runtime smoke test
- SQLite native-module load test

## 3. Scheduled jobs

- Codex latest tested version integration
- OpenCode latest tested version integration
- Claude SDK latest compatible version integration (post-v1, non-blocking)
- Seven-day or accelerated bridge endurance
- Dependency vulnerability scan
- Installer build and install/uninstall tests

## 4. Real-runtime security

Real-runtime jobs:

- never run for forked/untrusted PR code
- use disposable credentials where supported
- use disposable Git repositories
- deny network and destructive host operations unless the fixture needs them
- upload redacted results only

## 5. Mobile E2E

Use Maestro as the baseline.

Required flows:

- Pair by QR fixture
- See fake session
- Receive approval
- Approve once
- Disconnect/reconnect
- Verify no duplicate action
- Revoke device
- Offline stale state

## 6. Release pipelines

### Bridge

Target-specific jobs produce:

- macOS arm64 package
- macOS x64 package while supported
- Windows x64 installer
- Linux x64 archive/package
- Linux arm64 archive when supported

Each artifact includes:

- Node runtime
- bundled JS
- native database module
- schemas/migrations
- license notices
- SBOM
- checksum

### Mobile

- Development/internal builds
- TestFlight and Play internal track
- Release-candidate builds
- Store builds

EAS is optional. Native `xcodebuild`/Gradle workflows remain documented.

## 7. Required branch protections

- Protocol/schema owner approval for UCP changes
- Security owner approval for pairing/crypto/approval changes
- Migration owner approval for SQL changes
- At least one platform compile before merge
- No unresolved high/critical scan findings
