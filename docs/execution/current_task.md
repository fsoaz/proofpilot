# Current task

The local ProofPilot MVP is implemented. The remaining demo validation is a credentialed Live AI run. Rehearsal, the production dashboard, and worker recovery have been tested. [Test evidence](test_evidence.md)

## Live AI exit criteria

1. Set `AI_GATEWAY_API_KEY` in `.env.local`, start the worker, and run `npm run smoke:live`.
2. Start **Live AI** in the dashboard and observe a model-generated candidate reaching browser verification. If its checks fail, confirm the assertion is recorded and passed into the next attempt.
3. Record the generator, configured model, browser outcome, and evidence location in [Test evidence](test_evidence.md). A live run can verify with its first candidate.
