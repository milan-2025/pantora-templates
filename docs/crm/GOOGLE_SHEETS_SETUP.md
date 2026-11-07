# Sync a Google Sheet (or any form that writes to a sheet) into the CRM

1. Add an environment variable `SHEET_TOKEN` (a long random text) to your hosting, and redeploy.
2. In your Google Sheet: Extensions > Apps Script. Delete the sample code and paste:

```
const URL = 'https://pandoratemplates.com/CRM/api.php?r=sheet&token=YOUR_TOKEN';
function syncNew() {
  const sh = SpreadsheetApp.getActive().getSheets()[0], last = sh.getLastRow();
  const p = PropertiesService.getScriptProperties(), from = +(p.getProperty('done') || 1);
  if (last <= from) return;
  const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const vals = sh.getRange(from + 1, 1, last - from, hdr.length).getDisplayValues();
  const rows = vals.map(r => { const o = {}; hdr.forEach((h, i) => o[h] = r[i]); return o; });
  const res = UrlFetchApp.fetch(URL, {method: 'post', contentType: 'application/json',
    payload: JSON.stringify({rows}), muteHttpExceptions: true});
  if (res.getResponseCode() === 200) p.setProperty('done', String(last));
}
```
3. Replace YOUR_TOKEN with the same token. Row 1 of the sheet must be the column headers.
4. Click Run once (approve the permissions). The first run sends ALL existing rows.
   To send only future rows, first run this once instead: `PropertiesService.getScriptProperties().setProperty('done', String(SpreadsheetApp.getActive().getSheets()[0].getLastRow()))`
5. Triggers (clock icon) > Add trigger > function `syncNew`, event source "Time-driven", every 1 or 5 minutes.

New rows then appear in the CRM within a few minutes, with name, phone, email and campaign matched automatically and all other columns kept as extra fields. Duplicates (same phone or email) are skipped. Works for Google Forms too, since they write to a sheet.
