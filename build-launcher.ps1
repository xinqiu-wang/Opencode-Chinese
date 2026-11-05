$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$automation = & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command '[psobject].Assembly.Location'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework C# 编译器不存在。' }
$source = Join-Path $PSScriptRoot 'launcher.cs'
$output = Join-Path $PSScriptRoot 'OpenCodeZhCNTool.exe'
& $compiler /nologo /target:winexe /platform:anycpu /utf8output "/reference:$automation" /reference:System.Windows.Forms.dll "/out:$output" $source
if ($LASTEXITCODE -ne 0) { throw '启动器编译失败。' }
Get-Item -LiteralPath $output | Select-Object FullName, Length
