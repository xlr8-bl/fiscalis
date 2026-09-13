/**
 * GET /api/version — which build is actually running.
 *
 * This exists because of an hour spent on a bug that was not a bug: the
 * studio kept returning a sentence that had been deleted from the repo,
 * and the only way to tell a stale deployment from a broken fix was to
 * guess. Cloudflare's "Retry deployment" rebuilds that deployment's OWN
 * commit, so retrying a deployment made before the fix rebuilds the code
 * without the fix, and the dashboard reports success either way.
 *
 * `CF_PAGES_COMMIT_SHA` and `CF_PAGES_BRANCH` are set by Pages on a build
 * that came from git. Their absence is the answer to a different
 * question: this deployment did not come from git at all, so no push
 * will ever update it and it has to be deployed with wrangler.
 *
 * Public and unauthenticated, deliberately: a commit hash of a repository
 * whose URL is on the site already is not a secret, and a check that
 * needs a session is one more thing to be wrong when nothing works.
 */

export function onRequestGet({ env }) {
  const sha = env.CF_PAGES_COMMIT_SHA || null;
  return new Response(JSON.stringify({
    commit: sha,
    short: sha ? sha.slice(0, 7) : null,
    branch: env.CF_PAGES_BRANCH || null,
    from_git: Boolean(sha),
    note: sha
      ? 'This is the commit running. If it is behind the branch, the deployment '
        + 'is stale: make a NEW deployment rather than retrying an old one, which '
        + 'rebuilds the same commit.'
      : 'This deployment did not come from git, so pushing will never update it. '
        + 'Connect the Pages project to the repository, or deploy with '
        + '`npx wrangler pages deploy . --project-name=web3ashley`.',
  }, null, 2), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
