#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_name="reasonweave-codex-plugin"
marketplace_name="${REASONWEAVE_MARKETPLACE_NAME:-reasonweave-local}"
codex_home="${CODEX_HOME:-$HOME/.codex}"
source_plugin="$repo_root/plugins/$plugin_name"
source_agents="$source_plugin/agents/codex"
marketplace_root="$codex_home/reasonweave-marketplace"
plugins_root="$marketplace_root/plugins"
target_plugin="$plugins_root/$plugin_name"
marketplace_dir="$marketplace_root/.agents/plugins"
marketplace_path="$marketplace_dir/marketplace.json"
agents_target="$codex_home/agents"
config_path="$codex_home/config.toml"
suffix="$(date -u +%Y%m%d%H%M%S)-$$"
stage="$plugins_root/.$plugin_name.install-$suffix"
backup="$plugins_root/.$plugin_name.backup-$suffix"

if [[ ! -f "$source_plugin/.codex-plugin/plugin.json" ]]; then
  echo "Source plugin not found: $source_plugin" >&2
  exit 1
fi

if [[ ! -d "$source_agents" ]]; then
  echo "Codex agent templates not found: $source_agents" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to install ReasonWeave Codex CLI support." >&2
  exit 1
fi

mkdir -p "$plugins_root" "$marketplace_dir" "$agents_target" "$codex_home"

resolved_plugins_root="$(cd "$plugins_root" && pwd -P)"
case "$(dirname "$target_plugin")" in
  "$resolved_plugins_root") ;;
  *)
    echo "Refusing to replace plugin outside marketplace plugins root: $target_plugin" >&2
    exit 1
    ;;
esac

cleanup() {
  rm -rf "$stage"
}
trap cleanup EXIT

cp -a "$source_plugin" "$stage"

diff -qr "$source_plugin" "$stage" >/dev/null

node -e '
const fs = require("fs");
const path = process.argv[1];
const plugin = JSON.parse(fs.readFileSync(path, "utf8"));
const base = String(plugin.version || "0.1.0").split("+")[0];
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
plugin.version = `${base}+codex.local-${stamp}`;
fs.writeFileSync(path, `${JSON.stringify(plugin, null, 2)}\n`);
' "$stage/.codex-plugin/plugin.json"

if [[ -d "$target_plugin" ]]; then
  rm -rf "$backup"
  mv "$target_plugin" "$backup"
fi

if ! mv "$stage" "$target_plugin"; then
  if [[ -d "$backup" ]]; then
    mv "$backup" "$target_plugin"
  fi
  exit 1
fi

rm -rf "$backup"

node - "$marketplace_path" "$marketplace_name" "$plugin_name" <<'NODE'
const fs = require("fs");
const [path, marketplaceName, pluginName] = process.argv.slice(2);

let marketplace;
if (fs.existsSync(path)) {
  marketplace = JSON.parse(fs.readFileSync(path, "utf8"));
} else {
  marketplace = {
    name: marketplaceName,
    interface: { displayName: "ReasonWeave Local" },
    plugins: [],
  };
}

marketplace.name = marketplace.name || marketplaceName;
marketplace.interface = marketplace.interface || { displayName: "ReasonWeave Local" };
marketplace.plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
marketplace.plugins = marketplace.plugins.filter((plugin) => plugin.name !== pluginName);
marketplace.plugins.push({
  name: pluginName,
  source: {
    source: "local",
    path: `./plugins/${pluginName}`,
  },
  policy: {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL",
  },
  category: "Productivity",
});

fs.writeFileSync(path, `${JSON.stringify(marketplace, null, 2)}\n`);
NODE

for agent in "$source_agents"/*.toml; do
  target="$agents_target/$(basename "$agent")"
  cp "$agent" "$target"
  cmp -s "$agent" "$target"
done

if [[ ! -f "$config_path" ]]; then
  touch "$config_path"
fi

if ! grep -Eq '^\[agents\]\s*$' "$config_path"; then
  cp "$config_path" "$config_path.reasonweave-$suffix.bak"
  {
    printf '\n[agents]\n'
    printf 'max_threads = 6\n'
    printf 'max_depth = 1\n'
    printf 'job_max_runtime_seconds = 1800\n'
  } >> "$config_path"
fi

if command -v codex >/dev/null 2>&1; then
  if ! codex plugin marketplace list --json 2>/dev/null | grep -q "\"$marketplace_name\""; then
    codex plugin marketplace add "$marketplace_root"
  fi
  codex plugin add "$plugin_name@$marketplace_name" --json >/dev/null
fi

echo "Installed ReasonWeave plugin source to $target_plugin"
echo "Updated local marketplace at $marketplace_path"
echo "Installed Codex custom agents to $agents_target"
echo "Restart Codex or start a new thread so plugin, MCP, and agent metadata reload."
