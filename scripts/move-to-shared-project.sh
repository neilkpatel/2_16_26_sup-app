#!/bin/bash
# Move Sup's backend into the shared Supabase project (hufgsqlyaolefwhtvbub, "worldcup-picks").
# Neil picked this 9/15/26 because the original sup-app project is paused behind the free
# tier's 2-active-project cap. Every step is safe to re-run.
#
#   bash scripts/move-to-shared-project.sh
#
# Touches in the shared project: a new `sup` schema (plus PostGIS), PostgREST exposed schemas
# (+sup), auth config (autoconfirm + site_url; no other app there uses auth), 3 function
# secrets, 2 edge functions. Nothing outside `sup` is dropped or edited.
# Then, only if the smoke test passes: Vercel env vars + a production deploy.
set -euo pipefail
cd "$(dirname "$0")/.."

# This repo is public, so credentials live outside it.
TOK=${SUPABASE_ACCESS_TOKEN:-$(cat ~/.config/supabase/access_token)}
REF=hufgsqlyaolefwhtvbub
API="https://api.supabase.com/v1/projects/$REF"
VERCEL_TOKEN=$(cat ~/.config/whatagentsbuy/vercel_token)
VAPID=~/.config/sup-app/vapid.json
UA="Mozilla/5.0 sup-app-migrate"

step(){ printf '\n== %s\n' "$*"; }
api(){ curl -sS -A "$UA" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" "$@"; }
sql(){ python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$1" | api -X POST "$API/database/query" -d @-; }
scalar(){ sql "$1" | python3 -c 'import json,sys; r=json.load(sys.stdin); print(list(r[0].values())[0] if isinstance(r,list) and r else r)'; }

step "1/7 schema"
before=$(scalar "select count(*) from information_schema.tables where table_schema='public'")
existing=$(scalar "select count(*) from information_schema.tables where table_schema='sup'")
if [ "$existing" = "0" ]; then
  out=$(sql "begin; $(grep -v '^\s*--' supabase/schema.sql) commit;")
  echo "$out"
  case "$out" in *'"message"'*|*error*) echo "schema apply failed, stopping"; exit 1;; esac
else
  echo "sup schema already has $existing tables, skipping"
fi
after=$(scalar "select count(*) from information_schema.tables where table_schema='public'")
echo "sup tables: $(scalar "select string_agg(table_name, ', ' order by table_name) from information_schema.tables where table_schema='sup'")"
echo "public tables before/after: $before / $after"
[ "$before" = "$after" ] || { echo "public table count changed, stopping"; exit 1; }

step "2/7 expose the sup schema through the REST API"
cur=$(api "$API/postgrest" | python3 -c 'import json,sys; print(json.load(sys.stdin)["db_schema"])')
if [[ ",$cur," == *",sup,"* ]]; then
  echo "already exposed: $cur"
else
  new="$cur,sup"
  api -X PATCH "$API/postgrest" -d "{\"db_schema\": \"$new\"}" | python3 -c 'import json,sys; print("db_schema now:", json.load(sys.stdin).get("db_schema"))'
fi

step "3/7 auth: autoconfirm signups (Sup has no email step), site_url"
api -X PATCH "$API/config/auth" -d '{"mailer_autoconfirm": true, "site_url": "https://sup-app-jet.vercel.app"}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print({k: d.get(k) for k in ["mailer_autoconfirm","site_url","disable_signup"]})'

step "4/7 function secrets (values not printed)"
python3 - "$VAPID" <<'EOF' | api -X POST "$API/secrets" -d @- -o /dev/null -w "HTTP %{http_code}\n"
import json, re, sys
v = json.load(open(sys.argv[1]))
g = re.search(r'^VITE_GOOGLE_PLACES_API_KEY=(.*)$', open('.env').read(), re.M).group(1).strip()
print(json.dumps([
    {"name": "VAPID_PUBLIC_KEY", "value": v["publicKey"]},
    {"name": "VAPID_PRIVATE_KEY", "value": v["privateKey"]},
    {"name": "GOOGLE_PLACES_API_KEY", "value": g},
]))
EOF
api "$API/secrets" | python3 -c 'import json,sys; print("secret names:", sorted(s["name"] for s in json.load(sys.stdin)))'

step "5/7 deploy edge functions"
for fn in sup-send-push sup-nearby-places; do
  SUPABASE_ACCESS_TOKEN=$TOK npx --yes supabase functions deploy "$fn" --project-ref "$REF" --no-verify-jwt --use-api 2>&1 | tail -2
done

step "6/7 live smoke test (3 throwaway users, deleted afterwards)"
sleep 5   # PostgREST reloads its schema cache after step 2
set +e
node scripts/smoke.mjs
smoke=$?
set -e
sql "delete from auth.users where email like 'sup-smoke-%@neilkpatel.com'" >/dev/null
echo "cleanup: $(scalar "select count(*) from auth.users where email like 'sup-smoke-%@neilkpatel.com'") smoke users left, $(scalar "select count(*) from sup.users") sup profiles left"
[ "$smoke" = "0" ] || { echo "smoke test failed, NOT touching Vercel"; exit 1; }

step "7/7 Vercel env + production deploy"
python3 - <<'EOF' > "$TMPDIR/sup-env.tsv"
import re
s = open('.env').read()
for k in ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_VAPID_PUBLIC_KEY"]:
    print(k + "\t" + re.search(rf'^{k}=(.*)$', s, re.M).group(1).strip())
EOF
while IFS=$'\t' read -r name val; do
  vercel env rm "$name" production --yes --token "$VERCEL_TOKEN" >/dev/null 2>&1 || true
  printf '%s' "$val" | vercel env add "$name" production --token "$VERCEL_TOKEN" >/dev/null 2>&1 && echo "set $name"
done < "$TMPDIR/sup-env.tsv"
rm -f "$TMPDIR/sup-env.tsv"
vercel --prod --yes --token "$VERCEL_TOKEN" 2>&1 | grep -E "Production|Aliased|Error" | head -3
# The CDN can serve the previous build for a few seconds after the alias moves, so retry
for i in 1 2 3 4 5 6; do
  js=$(curl -s -H 'Cache-Control: no-cache' https://sup-app-jet.vercel.app | grep -o '/assets/index-[^"]*\.js' | head -1)
  if curl -s "https://sup-app-jet.vercel.app$js" | grep -q "$REF"; then
    echo "LIVE: sup-app-jet.vercel.app now talks to $REF"; exit 0
  fi
  sleep 5
done
echo "WARNING: live bundle still does not reference $REF"
