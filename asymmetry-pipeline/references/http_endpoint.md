# Apps Script HTTP Endpoint

Use `assets/apps-script-api/Code.gs` to expose the deterministic asymmetry pipeline as a Google Apps Script Web App endpoint.

## Request

POST JSON to the Web App URL:

```json
{
  "action": "run_asymmetry_pipeline",
  "inputs": [
    {
      "industry": "Healthcare",
      "content": "Pain: Prior authorization is slow and manual, causing appointment delays."
    }
  ]
}
```

The endpoint also accepts `industry_outputs` or `input.industry_outputs`, but `inputs` is the preferred agent-facing field.

## Response

Success:

```json
{
  "success": true,
  "data": {
    "signals": [],
    "patterns": [],
    "opportunities": [],
    "ranked_opportunities": [],
    "top_feasibility_memos": []
  }
}
```

Error:

```json
{
  "success": false,
  "error": "message"
}
```

## Persistence

`storeSignals(signals)` writes extracted signals to a `Signals` sheet after extraction. The pipeline output does not rely on stored data, so each request remains stateless.

Script Properties:

- `ASYMMETRY_STORE_SIGNALS=false`: disable signal storage.
- `ASYMMETRY_SPREADSHEET_ID=<spreadsheet id>`: store signals in this spreadsheet for standalone scripts.

If `ASYMMETRY_SPREADSHEET_ID` is absent, a spreadsheet-bound script uses the active spreadsheet.

## Deployment Notes

- Replace UI-oriented `Code.gs` handlers with the API `Code.gs`, or ensure there is only one global `doPost(e)` and one global `doGet(e)`.
- Deploy as a Web App.
- Set execution to the owner account.
- Set access according to the private URL model.
- Do not require `index.html`, `google.script.run`, or manual triggers.
