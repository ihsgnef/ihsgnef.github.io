#!/usr/bin/env bash
# Point shifeng.me at GitHub Pages, through Cloudflare.
#
#   bin/cf-cutover.sh            # dry run: preconditions + the plan
#   bin/cf-cutover.sh --apply    # make the change
#
# Run this only AFTER the nameservers have moved to Cloudflare and the zone is
# active. The script refuses to flip until Cloudflare's own certificate is
# issued, because that certificate is the whole point: shifeng.me sends HSTS
# with a two-year max-age, so any moment without a valid certificate is a hard
# connection failure for returning visitors, not a warning they can dismiss.
#
# Touches only the A/AAAA/CNAME records for the apex and www.
set -euo pipefail

ZONE="shifeng.me"
TARGET="ihsgnef.github.io"
APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

die() { echo "error: $*" >&2; exit 1; }

TOKEN_FILE="${CLOUDFLARE_TOKEN_FILE:-$HOME/.config/praxis/cloudflare-token}"
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -f "$TOKEN_FILE" ]]; then
  perms=$(stat -f '%Lp' "$TOKEN_FILE" 2>/dev/null || stat -c '%a' "$TOKEN_FILE")
  [[ "$perms" == "600" || "$perms" == "400" ]] ||
    die "$TOKEN_FILE is mode $perms — must be 600. Run: chmod 600 $TOKEN_FILE"
  CLOUDFLARE_API_TOKEN=$(tr -d '[:space:]' < "$TOKEN_FILE")
fi
[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] ||
  die "no Cloudflare token. Put one in $TOKEN_FILE (chmod 600), scoped Zone:DNS:Edit on $ZONE."

API="https://api.cloudflare.com/client/v4"
auth=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json")

A_RECORDS=(185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153)
AAAA_RECORDS=(2606:50c0:8000::153 2606:50c0:8001::153 2606:50c0:8002::153 2606:50c0:8003::153)

# ---- preconditions ---------------------------------------------------------

zone_json=$(curl -s "${auth[@]}" "$API/zones?name=$ZONE")
zone_id=$(echo "$zone_json" | python3 -c '
import json,sys
d=json.load(sys.stdin)
if not d.get("success"): sys.exit("cloudflare: "+json.dumps(d.get("errors")))
r=d.get("result")
if not r: sys.exit("zone %s is not in this Cloudflare account, or the token cannot see it.\n"
                   "Add the site at https://dash.cloudflare.com first." % sys.argv[1])
print(r[0]["id"])' "$ZONE")

zone_status=$(echo "$zone_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"][0]["status"])')
echo "zone $ZONE -> $zone_id (status: $zone_status)"
[[ "$zone_status" == "active" ]] ||
  die "zone is '$zone_status', not 'active'. The nameservers at GoDaddy have not taken effect yet. Wait, then re-run."

# Cloudflare's edge certificate must exist before we send traffic through it.
ssl=$(curl -s "${auth[@]}" "$API/zones/$zone_id/ssl/certificate_packs?status=all")
ssl_state=$(echo "$ssl" | python3 -c '
import json,sys
d=json.load(sys.stdin)
if not d.get("success"):
    print("unknown"); sys.exit(0)
packs=d.get("result") or []
states=[p.get("status") for p in packs]
print("active" if "active" in states else (",".join(states) if states else "none"))')
echo "cloudflare edge certificate: $ssl_state"
if [[ "$ssl_state" != "active" ]]; then
  echo
  echo "REFUSING TO FLIP. Cloudflare has no active certificate for this zone yet."
  echo "Universal SSL usually issues within ~15 minutes of the zone going active."
  echo "Check dash.cloudflare.com -> SSL/TLS -> Edge Certificates, then re-run."
  $APPLY && exit 1 || exit 0
fi

# ---- plan ------------------------------------------------------------------

records=$(curl -s "${auth[@]}" "$API/zones/$zone_id/dns_records?per_page=200")
doomed=$(echo "$records" | python3 -c '
import json,sys
zone=sys.argv[1]
d=json.load(sys.stdin)
if not d.get("success"): sys.exit("cloudflare: "+json.dumps(d.get("errors")))
for r in d["result"]:
    if r["type"] in ("A","AAAA","CNAME") and r["name"] in (zone, "www."+zone):
        print(r["id"], r["type"], r["name"], r["content"], "proxied" if r.get("proxied") else "dns-only")
' "$ZONE")

echo
echo "will DELETE:"
[[ -n "$doomed" ]] && echo "$doomed" | sed 's/^/  - /' || echo "  (none)"
echo
echo "will CREATE (all proxied, so Cloudflare's certificate covers the gap):"
for ip in "${A_RECORDS[@]}";    do echo "  + A     $ZONE -> $ip"; done
for ip in "${AAAA_RECORDS[@]}"; do echo "  + AAAA  $ZONE -> $ip"; done
echo "  + CNAME www.$ZONE -> $TARGET"
echo
echo "untouched: every other record type."

if ! $APPLY; then
  echo
  echo "dry run. re-run with --apply to make the change."
  exit 0
fi

backup="dns-backup-$ZONE.json"
echo "$records" | python3 -c '
import json,sys
zone=sys.argv[1]
d=json.load(sys.stdin)
keep=[r for r in d["result"] if r["type"] in ("A","AAAA","CNAME") and r["name"] in (zone,"www."+zone)]
json.dump(keep, open(sys.argv[2],"w"), indent=2)
print(f"saved {len(keep)} records to {sys.argv[2]}")' "$ZONE" "$backup"

echo
while read -r id type name content _; do
  [[ -z "${id:-}" ]] && continue
  echo "deleting $type $name ($content)"
  curl -s -X DELETE "${auth[@]}" "$API/zones/$zone_id/dns_records/$id" >/dev/null
done <<< "$doomed"

create() {
  echo "creating $1 $2 -> $3"
  curl -s -X POST "${auth[@]}" "$API/zones/$zone_id/dns_records" \
    --data "$(python3 -c '
import json,sys
print(json.dumps({"type":sys.argv[1],"name":sys.argv[2],"content":sys.argv[3],
                  "ttl":1,"proxied":True}))' "$1" "$2" "$3")" \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)
if not d.get("success"): sys.exit("  FAILED: "+json.dumps(d.get("errors")))'
}

for ip in "${A_RECORDS[@]}";    do create A    "$ZONE" "$ip"; done
for ip in "${AAAA_RECORDS[@]}"; do create AAAA "$ZONE" "$ip"; done
create CNAME "www.$ZONE" "$TARGET"

echo
echo "done. previous records saved to $backup."
echo "Do NOT set the zone SSL mode to Full (strict): GitHub serves Cloudflare a"
echo "*.github.io certificate, which strict mode rejects with a 526."
