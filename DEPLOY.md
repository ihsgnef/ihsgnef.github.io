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

## The DNS change

Unlike praxis-research.org, this domain's DNS is at **GoDaddy**, not Cloudflare.
There is no proxy to hide behind, so the records are edited in the GoDaddy DNS
manager (or via their API, which requires a key and secret from
developer.godaddy.com — note GoDaddy restricts API access on some account
tiers, so the dashboard may be the only route).

The whole zone today is two records. There is **no MX, TXT, or CAA record**, so
nothing else can break:

| Action | Type | Name | Value |
| --- | --- | --- | --- |
| replace | A | `@` | `76.76.21.21` → `185.199.108.153` |
| add | A | `@` | `185.199.109.153` |
| add | A | `@` | `185.199.110.153` |
| add | A | `@` | `185.199.111.153` |
| add | AAAA | `@` | `2606:50c0:8000::153` |
| add | AAAA | `@` | `2606:50c0:8001::153` |
| add | AAAA | `@` | `2606:50c0:8002::153` |
| add | AAAA | `@` | `2606:50c0:8003::153` |
| replace | CNAME | `www` | `cname.super.so` → `ihsgnef.github.io` |

## The certificate gap — read this before flipping

`shifeng.me` sends **HSTS with a two-year max-age** (from super.so). Between DNS
moving and GitHub issuing its certificate, HTTPS has no valid certificate, and a
browser that has seen that header will **refuse the connection** rather than
offer a click-through. Anyone who has visited before is affected.

praxis-research.org solved this by proxying through Cloudflare, whose edge
certificate was already valid. **That option does not exist here** — GoDaddy DNS
does not proxy. So either:

- **Accept a short gap.** Do it at a quiet hour. In the best case GitHub issues
  within a minute or two of seeing DNS.
- **Move DNS to Cloudflare first**, then proxy, exactly like praxis-research.org.
  Change the nameservers at GoDaddy, recreate these records in Cloudflare, and
  set the apex and `www` to proxied. This zone has only two records and no
  email, so it is an unusually safe zone to move — but it is still a separate
  job, and nameserver changes take time to propagate.

### Order of operations, if accepting the gap

The order matters, and it is not the obvious one:

1. **Set the custom domain first**, while DNS still points at super.so:
   Settings → Pages → Custom domain → `shifeng.me`. `static/CNAME` already
   carries it into every build, which is what stops a later deploy from clearing
   it. GitHub will report a failed DNS check; that is expected.
2. **Change the DNS records** at GoDaddy, per the table above.
3. **Immediately re-add the custom domain** — clear it and set it again. GitHub
   caches the failed DNS check from step 1, and on praxis-research.org that left
   `https_certificate.state` at `none` for over five minutes. Re-adding forces a
   fresh check and an immediate certificate request.
4. **Watch for the certificate**, then enforce HTTPS:

```bash
gh api repos/ihsgnef/ihsgnef.github.io/pages --jq '{cname,cert:.https_certificate.state}'
gh api -X PUT repos/ihsgnef/ihsgnef.github.io/pages -F https_enforced=true
```

Check the real path rather than your own resolver, which will happily serve you
a stale answer for an hour:

```bash
curl -sI --resolve shifeng.me:443:185.199.108.153 https://shifeng.me/
```

## URLs

Preserved: `/`, `/group/`, `/publications/`, `/teaching/`, `/faq/`, and
everything under `/docs/` and `/img/` from the old `ihsgnef.github.io`.

Gone: `/mitigating-collusive-self-preference-by-redaction-and-paraphrasing`,
the unfinished blog post, which was also removed from praxis-research.org.

## Rolling back

Restore the two original records at GoDaddy:

    A     shifeng.me      -> 76.76.21.21
    CNAME www.shifeng.me  -> cname.super.so

Nothing in this repo needs to change.
