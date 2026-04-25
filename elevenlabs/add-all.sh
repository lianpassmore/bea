#!/usr/bin/env bash
# Batch-register all of Bea's webhook tools with ElevenLabs.
#
# Usage:
#   BASE_URL=https://abc.ngrok.app ./add-all.sh
#   BASE_URL=https://bea.vercel.app ./add-all.sh
#
# Optional:
#   AGENT_NAME=bea ./add-all.sh   # also pushes the tool IDs into your agent
#
# Prerequisites:
#   - elevenlabs CLI installed and authenticated
#   - jq installed (for AGENT_NAME mode)
#   - tool_configs/*.json checked in alongside this script
set -euo pipefail

if [ -z "${BASE_URL:-}" ]; then
  echo "Error: BASE_URL is required." >&2
  echo "  Example: BASE_URL=https://abc.ngrok.app $0" >&2
  exit 1
fi

cd "$(dirname "$0")"

if [ ! -d tool_configs ]; then
  echo "Error: tool_configs/ directory not found." >&2
  exit 1
fi

added_ids=()

for cfg in tool_configs/*.json; do
  tool_name=$(basename "$cfg" .json)
  tmp=$(mktemp -t bea-tool.XXXXXX.json)
  # Substitute the placeholder. macOS sed and GNU sed both accept this form.
  sed "s|{{BASE_URL}}|$BASE_URL|g" "$cfg" > "$tmp"

  echo "→ Adding $tool_name"
  output=$(elevenlabs tools add "$tool_name" --type webhook --config-path "$tmp" 2>&1)
  echo "$output"

  # Best-effort parse of the returned tool ID for later wiring into the agent.
  tool_id=$(echo "$output" | grep -oE 'tool_[A-Za-z0-9]+' | head -n1 || true)
  if [ -n "$tool_id" ]; then
    added_ids+=("$tool_id")
  fi

  rm -f "$tmp"
done

echo ""
echo "Done. Tool IDs collected:"
printf '  %s\n' "${added_ids[@]}"

if [ -n "${AGENT_NAME:-}" ]; then
  if ! command -v jq >/dev/null 2>&1; then
    echo "Skipping agent wiring — jq not installed." >&2
    exit 0
  fi
  agent_dir="agent_configs"
  agent_file="$agent_dir/${AGENT_NAME}.json"
  if [ ! -f "$agent_file" ]; then
    echo "Pulling agent $AGENT_NAME …"
    elevenlabs agents pull --agent "$AGENT_NAME"
  fi
  echo "Patching $agent_file with tool IDs"
  ids_json=$(printf '%s\n' "${added_ids[@]}" | jq -R . | jq -s .)
  jq --argjson ids "$ids_json" \
    '.conversation_config.agent.prompt.tool_ids = $ids' \
    "$agent_file" > "$agent_file.tmp" && mv "$agent_file.tmp" "$agent_file"
  echo "Pushing agent $AGENT_NAME …"
  elevenlabs agents push --agent "$AGENT_NAME"
fi
