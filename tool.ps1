param(
    [switch]$Status,
    [string]$TargetPath,
    [string]$WorkingDirectory,
    [string]$UiSmokeTest
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$engine = Join-Path $PSScriptRoot 'patch.cjs'
$store = Join-Path $env:USERPROFILE 'OpencodeChinesePortable'
$portable = Join-Path $store 'bin\opencode.exe'
$settingsFile = Join-Path $store 'ui-settings.json'
$logDirectory = Join-Path $store 'logs'
$logFile = Join-Path $logDirectory 'tool.log'
$script:active = $null
$script:lastResult = $null
$script:smokeStage = 0
$script:smokeTicks = 0
$script:operationButtons = @()
$script:settings = $null

if (Test-Path -LiteralPath $settingsFile) {
    try { $script:settings = Get-Content -Raw -LiteralPath $settingsFile | ConvertFrom-Json }
    catch { $script:settings = $null }
}
function Find-OpenCode {
    $candidates = @(
        'D:\OpenCodeCLI\node_modules\@opencode\cli\bin\opencode.exe',
        $portable,
        (Join-Path $env:APPDATA 'npm\node_modules\@opencode\cli\bin\opencode.exe'),
        (Join-Path $env:USERPROFILE 'scoop\apps\opencode\current\opencode.exe')
    )
    $candidates += @(Get-Command opencode.exe -All -CommandType Application -ErrorAction SilentlyContinue | ForEach-Object Source)
    if ($script:settings.Target) { $candidates = @($script:settings.Target) + $candidates }
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            $resolved = (Get-Item -LiteralPath $candidate).FullName
            if ($seen.Add($resolved)) { $resolved }
        }
    }
}
function New-PatchProcess([string]$Action, [string]$File) {
    $node = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $node) { throw '找不到 Node.js。请安装 Node.js 22 或更新版本，再打开工具。' }
    if (-not $File -or $File.Contains('"')) { throw '请选择实际的 opencode.exe 文件。' }
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $node.Source
    $start.Arguments = '"' + $engine + '" ' + $Action + ' "' + $File + '"'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = [Text.Encoding]::UTF8
    $start.StandardErrorEncoding = [Text.Encoding]::UTF8
    $start.EnvironmentVariables['OPENCODE_ZH_PROGRESS'] = '1'
    return [Diagnostics.Process]::Start($start)
}
function Invoke-PatchStatus([string]$File) {
    $process = New-PatchProcess 'status' $File
    try {
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(15000)) {
            $process.Kill()
            throw '状态查询超时，请重新检查。'
        }
        $result = $output.GetAwaiter().GetResult() | ConvertFrom-Json
        $null = $errors.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw $result.error }
        return $result
    } finally { $process.Dispose() }
}

$found = @(Find-OpenCode)
$initial = if ($TargetPath) { $TargetPath } elseif ($found.Count) { $found[0] } else { '' }
$work = if ($WorkingDirectory) { $WorkingDirectory }
    elseif ($script:settings.Directory -and (Test-Path -LiteralPath $script:settings.Directory -PathType Container)) { $script:settings.Directory }
    elseif (Test-Path -LiteralPath 'D:\OpenCode' -PathType Container) { 'D:\OpenCode' }
    else { $env:USERPROFILE }

if ($Status) {
    try { Invoke-PatchStatus $initial | ConvertTo-Json -Compress; exit 0 }
    catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
}

[Windows.Forms.Application]::EnableVisualStyles()
$colors = @{
    Background = [Drawing.ColorTranslator]::FromHtml('#0b1220')
    Panel = [Drawing.ColorTranslator]::FromHtml('#131e31')
    Text = [Drawing.ColorTranslator]::FromHtml('#e5edf7')
    Muted = [Drawing.ColorTranslator]::FromHtml('#91a3ba')
    Blue = [Drawing.ColorTranslator]::FromHtml('#3b82f6')
    Green = [Drawing.ColorTranslator]::FromHtml('#34d399')
    Amber = [Drawing.ColorTranslator]::FromHtml('#fbbf24')
    Red = [Drawing.ColorTranslator]::FromHtml('#fb7185')
}
$form = [Windows.Forms.Form]::new()
$form.Text = 'Open code CLI 中文注入'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = [Drawing.Size]::new(920, 750)
$form.MinimumSize = [Drawing.Size]::new(936, 789)
$form.AutoScaleMode = 'None'
$form.BackColor = $colors.Background
$form.ForeColor = $colors.Text
$form.Font = [Drawing.Font]::new('Microsoft YaHei UI', 9)
$form.ShowInTaskbar = $true

function New-UiLabel($Parent, [string]$Text, [int]$X, [int]$Y, [int]$Width, [int]$Height, [single]$Size = 9) {
    $control = [Windows.Forms.Label]::new()
    $control.Text = $Text
    $control.SetBounds($X, $Y, $Width, $Height)
    $control.Font = [Drawing.Font]::new('Microsoft YaHei UI', $Size)
    $control.ForeColor = $colors.Text
    $Parent.Controls.Add($control)
    return $control
}
function New-UiButton($Parent, [string]$Text, [int]$X, [int]$Y, [int]$Width, [int]$Height, [bool]$Primary = $false) {
    $control = [Windows.Forms.Button]::new()
    $control.Text = $Text
    $control.SetBounds($X, $Y, $Width, $Height)
    $control.FlatStyle = 'Flat'
    $control.FlatAppearance.BorderSize = 0
    $control.BackColor = if ($Primary) { $colors.Blue } else { $colors.Panel }
    $control.ForeColor = $colors.Text
    $control.Cursor = [Windows.Forms.Cursors]::Hand
    $Parent.Controls.Add($control)
    return $control
}
function New-UiPanel([int]$Y, [int]$Height) {
    $panel = [Windows.Forms.Panel]::new()
    $panel.SetBounds(24, $Y, 872, $Height)
    $panel.Anchor = 'Top,Left,Right'
    $panel.BackColor = $colors.Panel
    $form.Controls.Add($panel)
    return $panel
}

$null = New-UiLabel $form 'Open code CLI 中文注入' 24 18 850 38 21
$subtitle = New-UiLabel $form '选择本机 OpenCode CLI，一键注入、检查或恢复简体中文。' 26 62 870 24
$subtitle.ForeColor = $colors.Muted

$pathPanel = New-UiPanel 102 112
$null = New-UiLabel $pathPanel 'OpenCode CLI 程序位置' 14 10 700 22
$pathBox = [Windows.Forms.ComboBox]::new()
$pathBox.SetBounds(14, 37, 626, 28)
$pathBox.Anchor = 'Top,Left,Right'
$pathBox.BackColor = $colors.Background
$pathBox.ForeColor = $colors.Text
$pathBox.FlatStyle = 'Flat'
foreach ($file in $found) { [void]$pathBox.Items.Add($file) }
$pathBox.Text = $initial
$pathPanel.Controls.Add($pathBox)
$browseButton = New-UiButton $pathPanel '选择程序' 650 35 94 30
$detectButton = New-UiButton $pathPanel '自动检测' 754 35 104 30
$browseButton.Anchor = 'Top,Right'
$detectButton.Anchor = 'Top,Right'
$versionLabel = New-UiLabel $pathPanel '支持 OpenCode 2.2.5 Windows x64' 14 78 830 24
$versionLabel.ForeColor = $colors.Muted

$directoryPanel = New-UiPanel 228 82
$null = New-UiLabel $directoryPanel 'OpenCode 启动目录' 14 8 650 22
$directoryBox = [Windows.Forms.TextBox]::new()
$directoryBox.SetBounds(14, 35, 730, 28)
$directoryBox.Anchor = 'Top,Left,Right'
$directoryBox.Text = $work
$directoryBox.BackColor = $colors.Background
$directoryBox.ForeColor = $colors.Text
$directoryBox.BorderStyle = 'FixedSingle'
$directoryPanel.Controls.Add($directoryBox)
$directoryButton = New-UiButton $directoryPanel '选择目录' 754 33 104 30
$directoryButton.Anchor = 'Top,Right'

$statusPanel = New-UiPanel 324 80
$statusLabel = New-UiLabel $statusPanel '等待检测' 16 9 830 28 13
$statusLabel.ForeColor = $colors.Blue
$detailLabel = New-UiLabel $statusPanel '选择 OpenCode 后，可检查版本、中文注入状态和原版备份。' 16 44 830 27
$detailLabel.ForeColor = $colors.Muted

$null = New-UiLabel $form '阶段进度' 24 420 872 24 10
$progressBar = [Windows.Forms.ProgressBar]::new()
$progressBar.SetBounds(24, 451, 872, 18)
$progressBar.Anchor = 'Top,Left,Right'
$form.Controls.Add($progressBar)
$phaseLabel = New-UiLabel $form '就绪' 24 478 872 24
$phaseLabel.ForeColor = $colors.Muted

$applyButton = New-UiButton $form '一键注入中文' 24 514 170 40 $true
$restoreButton = New-UiButton $form '还原原版' 206 514 130 40
$checkButton = New-UiButton $form '检查状态' 348 514 130 40
$openButton = New-UiButton $form '打开 OpenCode' 490 514 130 40
$backupButton = New-UiButton $form '查看备份' 632 514 126 40
$portableButton = New-UiButton $form '独立汉化版' 770 514 126 40
$script:operationButtons = @($pathBox, $browseButton, $detectButton, $directoryBox, $directoryButton,
    $applyButton, $restoreButton, $checkButton, $openButton, $backupButton, $portableButton)

$logBox = [Windows.Forms.TextBox]::new()
$logBox.SetBounds(24, 571, 872, 126)
$logBox.Anchor = 'Top,Bottom,Left,Right'
$logBox.Multiline = $true
$logBox.ReadOnly = $true
$logBox.ScrollBars = 'Vertical'
$logBox.BackColor = $colors.Panel
$logBox.ForeColor = $colors.Text
$logBox.BorderStyle = 'FixedSingle'
$logBox.Font = [Drawing.Font]::new('Microsoft YaHei UI', 8.5)
$form.Controls.Add($logBox)
$footer = New-UiLabel $form '备份与日志保存在用户目录 OpencodeChinesePortable 中。' 24 715 872 24
$footer.Anchor = 'Bottom,Left,Right'
$footer.ForeColor = $colors.Muted

function Add-UiLog([string]$Message) {
    $line = '[' + (Get-Date -Format 'HH:mm:ss') + '] ' + $Message
    $logBox.AppendText($line + [Environment]::NewLine)
    try {
        [IO.Directory]::CreateDirectory($logDirectory) | Out-Null
        [IO.File]::AppendAllText($logFile, $line + [Environment]::NewLine, [Text.Encoding]::UTF8)
    } catch { }
}
function Save-UiSettings {
    if ($UiSmokeTest) { return }
    try {
        [IO.Directory]::CreateDirectory($store) | Out-Null
        $settings = @{ Target = $pathBox.Text; Directory = $directoryBox.Text } | ConvertTo-Json
        [IO.File]::WriteAllText($settingsFile, $settings, [Text.Encoding]::UTF8)
    } catch { Add-UiLog ('无法保存窗口设置。' + $_.Exception.Message) }
}
function Set-UiBusy([bool]$Busy) {
    foreach ($control in $script:operationButtons) { $control.Enabled = -not $Busy }
    $form.UseWaitCursor = $Busy
}
function Set-UiError([string]$Message) {
    $statusLabel.Text = '操作未完成'
    $statusLabel.ForeColor = $colors.Red
    $detailLabel.Text = $Message
    $phaseLabel.Text = '已停止'
    Add-UiLog $Message
}
function Start-UiOperation([string]$Action, [string]$File = '', [string]$After = '') {
    if ($script:active) { return }
    if (-not $File) { $File = $pathBox.Text.Trim() }
    try {
        $progressBar.Value = 0
        $phaseLabel.Text = '正在启动操作'
        $statusLabel.Text = @{ status = '正在检查状态'; apply = '正在注入中文'; restore = '正在还原原版'; import = '正在创建独立副本' }[$Action]
        $statusLabel.ForeColor = $colors.Blue
        $detailLabel.Text = '处理完成后，结果会显示在此处。'
        Set-UiBusy $true
        Add-UiLog ($statusLabel.Text + '  ' + $File)
        $process = New-PatchProcess $Action $File
        $script:active = @{
            Process = $process
            Output = $process.StandardOutput.ReadToEndAsync()
            ErrorLine = $process.StandardError.ReadLineAsync()
            Action = $Action
            After = $After
            File = $File
        }
    } catch {
        Set-UiBusy $false
        Set-UiError $_.Exception.Message
    }
}
function Show-UiResult($Result, [string]$Action) {
    $script:lastResult = $Result
    $versionLabel.Text = 'OpenCode ' + $Result.version + '  ·  ' + $Result.variant
    $statusLabel.ForeColor = if ($Result.patched) { $colors.Green } else { $colors.Blue }
    if ($Result.updateAvailable) {
        $statusLabel.Text = '已注入中文 · 有新版汉化'
        $detailLabel.Text = '当前覆盖 ' + $Result.edits + ' 处文本，点击“一键注入中文”更新。'
        $statusLabel.ForeColor = $colors.Amber
    } elseif ($Result.patched) {
        $statusLabel.Text = '已注入简体中文'
        $detailLabel.Text = '当前版本覆盖 ' + $Result.edits + ' 处文本。重新打开 OpenCode 生效。'
    } else {
        $statusLabel.Text = if ($Action -eq 'restore') { '已还原英文原版' } else { '尚未注入中文' }
        $detailLabel.Text = '点击“一键注入中文”，工具将先核对并备份英文原版。'
    }
    $progressBar.Value = 100
    $phaseLabel.Text = '100% · ' + $statusLabel.Text
    Add-UiLog ($statusLabel.Text + '  ' + $Result.file)
    Add-UiLog ('原版备份  ' + $Result.backup)
    Save-UiSettings
}
$timer = [Windows.Forms.Timer]::new()
$timer.Interval = 100
$timer.Add_Tick({
    $job = $script:active
    if (-not $job) { return }
    try {
        while ($job.ErrorLine -and $job.ErrorLine.IsCompleted) {
            $line = $job.ErrorLine.GetAwaiter().GetResult()
            $job.ErrorLine = $null
            if ($null -eq $line) { break }
            try {
                $event = $line | ConvertFrom-Json
                if ($null -ne $event.progress -and $event.phase) {
                    $progressBar.Value = [Math]::Max($progressBar.Value, [Math]::Min(100, [int]$event.progress))
                    $phaseLabel.Text = $event.progress.ToString() + '% · ' + $event.phase
                    Add-UiLog $event.phase
                } else { Add-UiLog $line }
            } catch { Add-UiLog $line }
            $job.ErrorLine = $job.Process.StandardError.ReadLineAsync()
        }
        if (-not $job.Process.HasExited -or -not $job.Output.IsCompleted) { return }
        $output = $job.Output.GetAwaiter().GetResult()
        $result = $output | ConvertFrom-Json
        if ($job.Process.ExitCode -ne 0) {
            if ($result.error) { throw $result.error }
            throw '后台程序未成功完成，请查看日志。'
        }
        $job.Process.Dispose()
        $script:active = $null
        Set-UiBusy $false
        if ($job.After -eq 'portable-apply') {
            $pathBox.Text = $portable
            Start-UiOperation 'apply' $portable
            return
        }
        if ($job.Action -eq 'import') { $pathBox.Text = $result.file }
        Show-UiResult $result $job.Action
    } catch {
        if ($job.Process) { $job.Process.Dispose() }
        $script:active = $null
        Set-UiBusy $false
        Set-UiError $_.Exception.Message
    }
})
$timer.Start()

$applyButton.Add_Click({ Start-UiOperation 'apply' })
$restoreButton.Add_Click({ Start-UiOperation 'restore' })
$checkButton.Add_Click({ Start-UiOperation 'status' })
$detectButton.Add_Click({
    $paths = @(Find-OpenCode)
    $pathBox.Items.Clear()
    foreach ($path in $paths) { [void]$pathBox.Items.Add($path) }
    if ($paths.Count) {
        $pathBox.SelectedIndex = 0
        Start-UiOperation 'status'
    } else { Set-UiError '未自动找到 OpenCode，请点击“选择程序”。' }
})
$browseButton.Add_Click({
    $dialog = [Windows.Forms.OpenFileDialog]::new()
    try {
        $dialog.Title = '选择 OpenCode CLI 的 opencode.exe'
        $dialog.Filter = 'OpenCode CLI (opencode.exe)|opencode.exe'
        if ($dialog.ShowDialog($form) -eq 'OK') {
            $pathBox.Text = $dialog.FileName
            Start-UiOperation 'status'
        }
    } finally { $dialog.Dispose() }
})
$directoryButton.Add_Click({
    $dialog = [Windows.Forms.FolderBrowserDialog]::new()
    try {
        $dialog.SelectedPath = $directoryBox.Text
        if ($dialog.ShowDialog($form) -eq 'OK') {
            $directoryBox.Text = $dialog.SelectedPath
            Save-UiSettings
        }
    } finally { $dialog.Dispose() }
})
$pathBox.Add_SelectionChangeCommitted({ Start-UiOperation 'status' })
$backupButton.Add_Click({
    try {
        $directory = if ($script:lastResult.backup) { Split-Path -Parent $script:lastResult.backup } else { Join-Path $store 'backup' }
        [IO.Directory]::CreateDirectory($directory) | Out-Null
        Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $directory + '"')
        Add-UiLog ('已打开备份目录  ' + $directory)
    } catch { Set-UiError $_.Exception.Message }
})
$openButton.Add_Click({
    try {
        $file = $pathBox.Text.Trim()
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'OpenCode 程序路径不存在。' }
        if (-not (Test-Path -LiteralPath $directoryBox.Text -PathType Container)) { throw '启动目录不存在。' }
        Start-Process -FilePath $file -WorkingDirectory $directoryBox.Text
        Save-UiSettings
        Add-UiLog ('已打开 OpenCode  ' + $directoryBox.Text)
    } catch { Set-UiError $_.Exception.Message }
})
$portableButton.Add_Click({
    if (Test-Path -LiteralPath $portable -PathType Leaf) {
        $pathBox.Text = $portable
        Start-UiOperation 'apply' $portable
    } else { Start-UiOperation 'import' $pathBox.Text 'portable-apply' }
})
$form.Add_FormClosing({
    param($sender, $eventArgs)
    if ($script:active) {
        $eventArgs.Cancel = $true
        $detailLabel.Text = '操作正在进行，请等待完成后再关闭。'
    }
})
$form.Add_Shown({
    $form.WindowState = 'Normal'
    $form.TopMost = $true
    $form.Activate()
    $form.TopMost = $false
    $form.BringToFront()
    Add-UiLog '工具窗口已打开。'
    Start-UiOperation 'status'
})

if ($UiSmokeTest) {
    [IO.Directory]::CreateDirectory($UiSmokeTest) | Out-Null
    $smokeTimer = [Windows.Forms.Timer]::new()
    $smokeTimer.Interval = 200
    $smokeTimer.Add_Tick({
        $script:smokeTicks++
        if ($script:smokeTicks -gt 600 -or (-not $script:active -and $statusLabel.Text -eq '操作未完成')) {
            $smokeTimer.Stop()
            @{ Success = $false; Error = $detailLabel.Text; Visible = $form.Visible } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $UiSmokeTest 'result.json') -Encoding UTF8
            if ($script:active) { $script:active.Process.Kill(); $script:active = $null }
            $form.Close()
            return
        }
        if ($script:active -or -not $script:lastResult) { return }
        if ($script:smokeStage -eq 0) {
            $script:smokeStage = 1
            if ($TargetPath) {
                $applyButton.PerformClick()
                $script:smokeBusy = -not $checkButton.Enabled
            } else { $checkButton.PerformClick() }
            return
        }
        if ($TargetPath -and $script:smokeStage -eq 1) {
            if (-not $script:lastResult.patched) { throw '注入按钮自测失败。' }
            $script:smokeStage = 2
            $restoreButton.PerformClick()
            return
        }
        $smokeTimer.Stop()
        $bitmap = [Drawing.Bitmap]::new($form.Width, $form.Height)
        try {
            $form.DrawToBitmap($bitmap, [Drawing.Rectangle]::new(0, 0, $form.Width, $form.Height))
            $bitmap.Save((Join-Path $UiSmokeTest 'window.png'), [Drawing.Imaging.ImageFormat]::Png)
        } finally { $bitmap.Dispose() }
        @{
            Success = ($form.Visible -and $form.IsHandleCreated -and $progressBar.Value -eq 100)
            Visible = $form.Visible
            Title = $form.Text
            Status = $statusLabel.Text
            Texts = @($script:operationButtons | ForEach-Object Text)
            LogLines = $logBox.Lines.Count
            CheckedState = $script:lastResult
            Roundtrip = ($TargetPath -and $script:smokeStage -eq 2 -and -not $script:lastResult.patched)
            BusyControlsLocked = $script:smokeBusy
            HostProcess = [Diagnostics.Process]::GetCurrentProcess().ProcessName
        } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $UiSmokeTest 'result.json') -Encoding UTF8
        $form.Close()
    })
    $smokeTimer.Start()
}
try { [void]$form.ShowDialog() }
finally {
    $timer.Stop()
    $timer.Dispose()
    if ($smokeTimer) { $smokeTimer.Dispose() }
    $form.Dispose()
}
