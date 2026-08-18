#!/bin/sh
set -eu

IOS_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

SWIFT_VERSION=$(xcrun swift --version 2>/dev/null | sed -n 's/.*Apple Swift version \([0-9][0-9]*\.[0-9][0-9]*\).*/\1/p')
if [ -z "$SWIFT_VERSION" ]; then
  echo "Unable to read the selected Xcode Swift toolchain. Accept its license first with:" >&2
  echo "sudo --preserve-env=DEVELOPER_DIR xcodebuild -license" >&2
  exit 1
fi
case "$SWIFT_VERSION" in
  6.2|6.3|6.4|[7-9].*) ;;
  *)
    echo "Agent Deck iOS build requires Xcode 26.0+ (Swift tools 6.2); found ${SWIFT_VERSION:-unknown}." >&2
    echo "Install/select Xcode 26.0+ with: xcodes install 26.6 --select" >&2
    exit 1
    ;;
esac

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
exec "$IOS_DIR/node_modules/.bin/expo" run:ios "$@"
