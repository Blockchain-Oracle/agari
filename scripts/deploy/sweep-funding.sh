#!/usr/bin/env bash
# Sweep every faucet inbox into the deployer.
#
# The devnet faucet rate-limits per destination address, so funding arrives across several
# throwaway keys (`~/.config/agari/devnet/faucet-inbox-*.json`) rather than one. This pulls
# whatever has landed into the deployer and leaves the empty ones alone.
set -euo pipefail

DIR="${AGARI_KEYS:-$HOME/.config/agari/devnet}"
DEPLOYER=$(solana-keygen pubkey "$DIR/deployer.json")
URL="${SOLANA_URL:-devnet}"
# A sweep of ALL still pays its own fee, so anything at or under this is not worth a transaction.
DUST=0.001

swept=0
for key in "$DIR"/faucet-inbox-*.json "$DIR"/funding-inbox.json; do
  [ -f "$key" ] || continue
  address=$(solana-keygen pubkey "$key")
  balance=$(solana balance "$address" --url "$URL" | awk '{print $1}')
  if awk -v b="$balance" -v d="$DUST" 'BEGIN { exit !(b > d) }'; then
    echo "sweeping $balance SOL from $address"
    solana transfer "$DEPLOYER" ALL --from "$key" --fee-payer "$key" --url "$URL" --commitment confirmed
    swept=$((swept + 1))
  fi
done

[ "$swept" -eq 0 ] && echo "nothing to sweep"
echo "deployer: $(solana balance "$DEPLOYER" --url "$URL")"
