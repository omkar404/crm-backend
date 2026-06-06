$ErrorActionPreference = "Stop"

param(
  [string]$ServerHost = "13.233.145.91",
  [string]$ServerUser = "ubuntu",
  [string]$PemPath = "D:\eximinq-crmpanel-frontend.pem",
  [string]$RemoteDir = "/home/ubuntu/crmpanel-backend",
  [string]$ArchiveName = "backend-fix.tar.gz",
  [int]$NodeMemoryMb = 1024
)

Set-Location $PSScriptRoot

Write-Host "Packaging backend..." -ForegroundColor Cyan
if (Test-Path $ArchiveName) {
  Remove-Item $ArchiveName -Force
}
tar -czf $ArchiveName --exclude=$ArchiveName --exclude=node_modules --exclude=.git .
if ($LASTEXITCODE -ne 0) {
  throw "Backend archive creation failed."
}

Write-Host "Uploading backend archive..." -ForegroundColor Cyan
scp -i $PemPath $ArchiveName "${ServerUser}@${ServerHost}:${RemoteDir}/"
if ($LASTEXITCODE -ne 0) {
  throw "Backend archive upload failed."
}

$remoteCommand = @"
set -e
cd $RemoteDir
tar -xzf $ArchiveName
npm install --production
NODE_OPTIONS=--max-old-space-size=$NodeMemoryMb pm2 restart backend --update-env
pm2 save
curl -s http://127.0.0.1:5000/health
"@

Write-Host "Deploying backend on server..." -ForegroundColor Cyan
ssh -i $PemPath "${ServerUser}@${ServerHost}" $remoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "Remote backend deploy failed."
}

Write-Host "Backend deploy completed." -ForegroundColor Green
