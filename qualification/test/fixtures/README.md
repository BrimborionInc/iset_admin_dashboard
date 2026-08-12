# Synthetic Fixtures

Every fixture in this directory is owned by the qualification package and has no
PATH application, environment, network, database, cloud, browser, or deployed
dependency. `candidate/source.txt` is an inert byte fixture for deterministic
identity and drift tests.

`commands/` contains exactly seven Sprint 2D certification commands:

- `pass.js` and `fail.js` provide bounded success and nonzero native results;
- `hang.js` provides fixed startup, idle, and execution timeout modes;
- `ignore-termination.js` provides a fixed graceful-shutdown refusal;
- `spawn-descendant.js` creates one fixed child from that same directory so
  whole-process-group termination can be proved;
- `write-marker.js` creates or removes one attempt-bound marker only beneath a
  test-owned `rq-process-control-*` temporary root; and
- `emit-result.js` provides fixed valid, missing, truncated, corrupt, duplicate,
  and stale result modes.

The command policy binds exact file digests and complete argument vectors. These
fixtures are certification inputs, not adapters or product test packs.
