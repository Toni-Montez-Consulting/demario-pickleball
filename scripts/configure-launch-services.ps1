param(
  [ValidateSet("production", "preview", "development")]
  [string]$Target = "production",

  [switch]$Apply,
  [switch]$Verify,
  [switch]$SkipResendLogin,
  [switch]$SkipSentryLogin
)

$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command '$Name'. Install it before running this script."
  }
}

function Get-VercelEnvList {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & vercel env list $Target 2>&1 | Out-String
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  if ($exitCode -ne 0) {
    throw "Failed to read Vercel $Target environment variables.`n$output"
  }
  return $output
}

function Test-VercelEnvExists {
  param(
    [string]$ListOutput,
    [string]$Name
  )
  return $ListOutput -match "(?m)^\s*$([regex]::Escape($Name))\s+"
}

function Set-VercelEnv {
  param(
    [string]$Name,
    [string]$Value,
    [switch]$Sensitive
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    Write-Host "skip ${Name}: no local value provided"
    return
  }

  $args = @("env", "add", $Name, $Target, "--force", "--yes", "--value", $Value)
  if ($Sensitive) {
    $args += "--sensitive"
  }

  Write-Host "setting $Name in Vercel $Target"
  & vercel @args | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set $Name in Vercel $Target."
  }
}

function Invoke-CommandLine {
  param([string]$CommandLine)
  $output = cmd /c "$CommandLine 2>&1" | Out-String
  if ($output.Trim()) {
    Write-Host $output.Trim()
  }
  return $LASTEXITCODE
}

Require-Command "vercel"
Require-Command "resend"
Require-Command "sentry-cli"

Write-Host "Vercel account:"
& vercel whoami | Out-Host

$envList = Get-VercelEnvList
$required = @(
  "RESEND_API_KEY",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN"
)

Write-Host ""
Write-Host "Current Vercel $Target launch env status:"
foreach ($name in $required) {
  $status = if (Test-VercelEnvExists $envList $name) { "present" } else { "missing" }
  Write-Host "- ${name}: $status"
}

if ($Apply) {
  $resendKey = $env:RESEND_API_KEY
  $sentryDsn = $env:SENTRY_DSN
  $publicSentryDsn = if ($env:NEXT_PUBLIC_SENTRY_DSN) { $env:NEXT_PUBLIC_SENTRY_DSN } else { $sentryDsn }

  Set-VercelEnv -Name "RESEND_API_KEY" -Value $resendKey -Sensitive
  Set-VercelEnv -Name "SENTRY_DSN" -Value $sentryDsn -Sensitive
  Set-VercelEnv -Name "NEXT_PUBLIC_SENTRY_DSN" -Value $publicSentryDsn
  Set-VercelEnv -Name "SENTRY_ORG" -Value $env:SENTRY_ORG
  Set-VercelEnv -Name "SENTRY_PROJECT" -Value $env:SENTRY_PROJECT
  Set-VercelEnv -Name "SENTRY_AUTH_TOKEN" -Value $env:SENTRY_AUTH_TOKEN -Sensitive

  if ($resendKey -and -not $SkipResendLogin) {
    Write-Host "logging into Resend CLI with RESEND_API_KEY"
    & resend login --key $resendKey --json | Out-Host
  }

  if ($env:SENTRY_AUTH_TOKEN -and -not $SkipSentryLogin) {
    Write-Host "logging into Sentry CLI with SENTRY_AUTH_TOKEN"
    & sentry-cli login --auth-token $env:SENTRY_AUTH_TOKEN --quiet | Out-Host
  }
}

if ($Verify) {
  Write-Host ""
  Write-Host "Resend CLI auth:"
  $resendLocalExit = Invoke-CommandLine "resend whoami"
  if ($resendLocalExit -ne 0) {
    Write-Host "Local Resend CLI is not logged in. This is okay if Vercel has RESEND_API_KEY."
  }

  Write-Host ""
  Write-Host "Resend auth using Vercel $Target env:"
  $resendVercelExit = Invoke-CommandLine "vercel env run -e $Target -- resend whoami"
  if ($resendVercelExit -ne 0) {
    Write-Host "Could not verify Resend through Vercel env. Check RESEND_API_KEY or run a live booking email test."
  }

  Write-Host ""
  Write-Host "Sentry CLI auth:"
  $sentryExit = Invoke-CommandLine "sentry-cli info"
  if ($sentryExit -ne 0) {
    Write-Host "Sentry CLI is not logged in yet. Provide SENTRY_AUTH_TOKEN and rerun with -Apply, or run sentry-cli login."
  }
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "- Redeploy after changing Vercel env vars."
Write-Host "- Submit one live booking and confirm student/admin emails arrive."
Write-Host "- While logged into admin with MFA, POST /api/monitoring-test and confirm a Sentry event appears."
