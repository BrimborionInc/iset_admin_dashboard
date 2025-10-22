# Test Environment Deployment Notes

## One-command deploy (recommended)

Run the automated script:

```powershell
npm run deploy-admin-to-test
```

What it does:
- Builds the React app with `.env.test`
- Packages the build plus server assets into a zip
- Uploads the zip to `s3://nwac-test-artifacts/admin-dashboard/`
- Uses SSM to roll the update out to every instance in the `nwac-test-asg` Auto Scaling Group
- Installs dependencies, refreshes `/opt/nwac/admin-dashboard`, sets `NODE_ENV=production`, and restarts PM2
- Waits for the SSM command to finish and surfaces any errors it encounters

If the script fails it will print the AWS CLI error output so you can forward it for troubleshooting.

## Manual fall-back (legacy process)

These steps are kept for reference in case you ever need to perform the deployment by hand.

1. Build with test variables  
   `npm run build:test`
2. Package the artefact (build/, isetadminserver.js, package.json, package-lock.json, .env.test) using `Compress-Archive`
3. Upload the zip to `s3://nwac-test-artifacts/admin-dashboard/` (or presign it)
4. Craft an SSM `AWS-RunShellScript` payload that downloads the zip, copies the files into place, installs dependencies, and restarts PM2
5. Execute `aws ssm send-command` against each instance in the fleet and poll until the status is `Success`
6. Perform a quick smoke test and clean up the temporary zip once verified

> **Reminder:** Avoid the legacy `deploy.ps1` workflow; use the automated script above or the manual SSM approach if you need absolute control.
