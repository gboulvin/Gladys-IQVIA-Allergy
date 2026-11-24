# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, ZIP codes and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## What the integration handles

- It stores no credential: IQVIA's public forecasts need no account and no
  API key. The only user data it reads is the list of ZIP codes of its
  configuration, sent to the IQVIA websites to get their forecasts.
- It only talks to `www.pollen.com` and `www.asthmaforecast.com` over HTTPS,
  and to Gladys through the integration SDK.
- It runs in the Gladys sandbox: read-only root filesystem, non-root user, no
  write outside `/data` (where it writes nothing).

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the third-party services the integration talks to (IQVIA's websites).
