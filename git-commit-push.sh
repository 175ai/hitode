#!/usr/bin/env bash
set -euo pipefail

cd /home/kj/hitode

COMMIT_MESSAGE="${1:-update}"
MAX_FILE_SIZE_BYTES=$((5 * 1024 * 1024))

# Only these large artifacts are intentionally versioned.
ALLOWED_LARGE_FILE_REGEX='^(vendor/kuromoji/dic/.*\.dat\.gz|vendor/kuromoji/kuromoji\.js)$'

is_blocked_path() {
	local path="$1"

	case "$path" in
		node_modules/*|.cache/*|.DS_Store|*.log|*.tmp|*.swp|*.swo|*.bak)
			return 0
			;;
		*.env|*.env.*|*.key|*.pem|*.p12|*.pfx|*.crt|*.sqlite|*.db)
			return 0
			;;
		*id_rsa*|*id_ed25519*)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

stage_changes() {
	git add -A
}

collect_staged_files() {
	git diff --cached --name-only
}

check_staged_files() {
	local has_errors=false
	local blocked_files=()
	local oversized_files=()

	mapfile -t staged_files < <(collect_staged_files)

	if [[ ${#staged_files[@]} -eq 0 ]]; then
		echo "No changes to commit."
		exit 0
	fi

	for path in "${staged_files[@]}"; do
		if is_blocked_path "$path"; then
			blocked_files+=("$path")
			has_errors=true
			continue
		fi

		if [[ -f "$path" ]]; then
			local size
			size=$(stat -c '%s' "$path")
			if (( size > MAX_FILE_SIZE_BYTES )) && [[ ! "$path" =~ $ALLOWED_LARGE_FILE_REGEX ]]; then
				oversized_files+=("$path ($size bytes)")
				has_errors=true
			fi
		fi
	done

	if [[ "$has_errors" == true ]]; then
		echo "Staging blocked by policy checks."
		if [[ ${#blocked_files[@]} -gt 0 ]]; then
			echo ""
			echo "Blocked file patterns detected:"
			printf '  - %s\n' "${blocked_files[@]}"
		fi

		if [[ ${#oversized_files[@]} -gt 0 ]]; then
			echo ""
			echo "Unexpected large files detected (> ${MAX_FILE_SIZE_BYTES} bytes):"
			printf '  - %s\n' "${oversized_files[@]}"
		fi

		echo ""
		echo "Unstaging all files so you can review safely..."
		git restore --staged .
		exit 1
	fi
}

stage_changes
check_staged_files

git commit -m "$COMMIT_MESSAGE"
git push -u origin main