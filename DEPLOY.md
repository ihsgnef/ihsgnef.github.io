# Deployment

**Repo:** `ihsgnef/ihsgnef.github.io` (public — GitHub Pages requires it)
**Host:** GitHub Pages, built by `.github/workflows/deploy.yml`
**Domain:** `shifeng.me`
**Registrar and DNS:** both GoDaddy (nameservers `ns35`/`ns36.domaincontrol.com`)

Push to `main` and the site rebuilds and deploys. A failed link check blocks the
deploy. There is nothing else to operate.

Note this repo is `<user>.github.io`, so it is served at the root of
`https://ihsgnef.github.io/` and every root-relative path resolves both there
and on the custom domain.

## Moving DNS to Cloudflare, then cutting over

The domain is registered at GoDaddy and its DNS is there too. We are moving DNS
to Cloudflare first, so the cutover can go through Cloudflare's proxy — the same
arrangement as praxis-research.org, and for the same reason.

### Why, in one paragraph

`shifeng.me` sends **HSTS with a two-year max-age**. Any window without a valid
certificate is a hard connection failure for returning visitors, not a warning
they can click through. Pointing GoDaddy's records straight at GitHub opens
exactly that window while GitHub provisions, and on praxis-research.org GitHub
had not even started after five minutes. Proxying through Cloudflare closes it:
Cloudflare terminates TLS with its own certificate and forwards to GitHub.

### The sequence

The order is chosen so that **every step is a no-op for visitors until the last
one**, which is instant.

1. **Add the site at Cloudflare** — dash.cloudflare.com → Add a site →
   `shifeng.me` → Free plan. Cloudflare scans GoDaddy and imports what it finds:
   `A @ -> 76.76.21.21` and `CNAME www -> cname.super.so`.

2. **Set both records to DNS-only (grey cloud) before going further.** Cloudflare
   defaults new records to proxied, and proxying before its certificate exists
   would create the very gap we are avoiding. DNS-only reproduces today's
   behaviour exactly: Vercel keeps serving, with its own valid certificate.

3. **Change the nameservers at GoDaddy** to the two Cloudflare gives you.
   Because step 2 made the records identical to today's, nothing changes for
   visitors. This is the slow step — usually minutes, occasionally hours.

4. **Wait for the zone to go active and the certificate to issue.**
   Cloudflare → SSL/TLS → Edge Certificates should show an active Universal SSL
   certificate. `bin/cf-cutover.sh` checks both and refuses to continue
   otherwise.

5. **Tell GitHub the domain is ours** — Settings → Pages → Custom domain →
   `shifeng.me`. `static/CNAME` already carries it into every build, which is
   what stops a later deploy from clearing it. From here
   `ihsgnef.github.io` redirects to `shifeng.me`, so staging stops being
   separately viewable.

6. **Flip the records.** This is the only visitor-visible moment, and it is
   instant because Cloudflare's certificate is already in hand:

   ```bash
   bin/cf-cutover.sh            # preconditions + plan, changes nothing
   bin/cf-cutover.sh --apply
   ```

   It repoints the apex and `www` at GitHub Pages, proxied, and backs up what it
   deletes first.

### The token

`bin/cf-cutover.sh` reads `~/.config/praxis/cloudflare-token` (mode 600). The
existing token is scoped to praxis-research.org, so it needs replacing with one
whose zone resources include `shifeng.me` — Zone:DNS:Edit is enough for the
flip; adding the site in step 1 is a dashboard action either way. Revoke it
afterwards at <https://dash.cloudflare.com/profile/api-tokens>.

### Afterwards

- **Do not set the zone SSL mode to "Full (strict)"** — GitHub serves Cloudflare
  a `*.github.io` certificate, which strict mode rejects with a 526.
- GitHub will never issue its own certificate while the records are proxied, and
  `https_enforced` cannot be turned on. That is expected.
- **HSTS will stop being sent**, because it came from super.so and GitHub does
  not send it. Re-enable it under Cloudflare → SSL/TLS → Edge Certificates if
  you want it, once you are sure you will not need plain HTTP on this domain.
- Cloudflare prepends a managed content-signals block to `robots.txt`, as it
  does on praxis-research.org. Toggle it in the dashboard if unwanted.

## URLs

Preserved: `/`, `/group/`, `/publications/`, `/teaching/`, `/faq/`, and
everything under `/docs/` and `/img/` from the old `ihsgnef.github.io`.

Gone: `/mitigating-collusive-self-preference-by-redaction-and-paraphrasing`,
the unfinished blog post, which was also removed from praxis-research.org.

## Rolling back

After step 6, restore the two original records — `bin/cf-cutover.sh` saves them
to `dns-backup-shifeng.me.json` before deleting anything:

    A     shifeng.me      -> 76.76.21.21
    CNAME www.shifeng.me  -> cname.super.so

Before step 6, rolling back just means pointing the nameservers back at
`ns35`/`ns36.domaincontrol.com` at GoDaddy. Nothing in this repo changes either
way.
