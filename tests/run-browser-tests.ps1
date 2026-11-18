param(
    [string]$BrowserPath,
    [switch]$ForceFailure,
    [switch]$CaptureFillReview,
    [switch]$CapturePatternReview,
    [switch]$CapturePaletteReview,
    [switch]$CaptureOpacityReview,
    [ValidateSet('before', 'after', 'final')][string]$CaptureWorkspaceReview
)
$ErrorActionPreference = 'Stop'
$runRoot = Join-Path ([IO.Path]::GetTempPath()) ('copyblocks-tests-' + [guid]::NewGuid().ToString('N'))
$browserProcess = $null
try {
    if (!$BrowserPath) {
        $candidates = @(
            "$env:ProgramFiles/Google/Chrome/Application/chrome.exe",
            "${env:ProgramFiles(x86)}/Microsoft/Edge/Application/msedge.exe",
            "$env:LOCALAPPDATA/Google/Chrome/Application/chrome.exe"
        )
        $BrowserPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    }
    if (!$BrowserPath -or !(Test-Path -LiteralPath $BrowserPath)) { throw 'Install Chrome or Edge, or supply -BrowserPath.' }
    $profile = Join-Path $runRoot 'profile'
    $downloads = Join-Path $runRoot 'downloads'
    New-Item -ItemType Directory -Path (Join-Path $profile 'Default'), $downloads -Force | Out-Null
    @{ download = @{ default_directory = $downloads; prompt_for_download = $false; directory_upgrade = $true } } |
        ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $profile 'Default/Preferences')
    $testPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'browser.html')).Path
    $testUrl = ([uri]$testPath).AbsoluteUri
    if ($ForceFailure) { $testUrl += '?forceFailure=1' }
    $stdout = Join-Path $runRoot 'stdout.txt'
    $stderr = Join-Path $runRoot 'stderr.txt'
    $arguments = @('--headless', '--window-size=1400,1000', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--allow-file-access-from-files', ('--user-data-dir="' + $profile + '"'),
        '--remote-debugging-port=0', ('"' + $testUrl + '"'))
    $browserProcess = Start-Process -FilePath $BrowserPath -ArgumentList $arguments -WindowStyle Hidden `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    $portFile = Join-Path $profile 'DevToolsActivePort'
    while (!(Test-Path -LiteralPath $portFile)) {
        if ([DateTime]::UtcNow -gt $deadline -or $browserProcess.HasExited) { throw 'Browser did not start debugging endpoint.' }
        Start-Sleep -Milliseconds 100
    }
    $debugPort = (Get-Content -LiteralPath $portFile)[0]
    $targets = Invoke-RestMethod "http://127.0.0.1:$debugPort/json/list"
    $target = $targets | Where-Object { $_.type -eq 'page' -and $_.url -eq $testUrl } | Select-Object -First 1
    if (!$target) { throw 'Test page debugging target was not found.' }
    $socket = New-Object System.Net.WebSockets.ClientWebSocket
    $null = $socket.ConnectAsync([uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $script:messageId = 0
    function Invoke-PageCommand($method, $params) {
        $script:messageId++
        $id = $script:messageId
        $json = @{id=$id; method=$method; params=$params} | ConvertTo-Json -Depth 8 -Compress
        $bytes = [Text.Encoding]::UTF8.GetBytes($json)
        $cancel = New-Object Threading.CancellationTokenSource
        $cancel.CancelAfter(5000)
        try {
            $null = $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, $cancel.Token).GetAwaiter().GetResult()
            do {
                $message = New-Object IO.MemoryStream
                try {
                    do {
                        $buffer = New-Object byte[] 65536
                        $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $cancel.Token).GetAwaiter().GetResult()
                        if ($received.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close) { throw 'Browser connection closed.' }
                        $message.Write($buffer, 0, $received.Count)
                    } until ($received.EndOfMessage)
                    $reply = [Text.Encoding]::UTF8.GetString($message.ToArray()) | ConvertFrom-Json
                } finally { $message.Dispose() }
            } until ($reply.id -eq $id)
            if ($reply.error) { throw ($reply.error | ConvertTo-Json -Compress) }
            return $reply.result
        } finally { $cancel.Dispose() }
    }
    do {
        $evaluation = Invoke-PageCommand 'Runtime.evaluate' @{expression='JSON.stringify({status:document.querySelector("#results")?.dataset.status, html:document.documentElement.outerHTML, key:window.testKey, pointer:window.testPointer, motion:window.testMotion})'; returnByValue=$true}
        $state = $evaluation.result.value | ConvertFrom-Json
        if ($state.motion) {
            if ($state.motion -notin @('reduce', 'no-preference')) { throw 'Unsupported motion preference.' }
            $null = Invoke-PageCommand 'Emulation.setEmulatedMedia' @{features=@(@{name='prefers-reduced-motion'; value=$state.motion})}
            $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='window.testMotion = null'}
        }
        if ($state.key) {
            $keyCodes = @{Enter=13; Space=32; Tab=9; Escape=27; Home=36; End=35; ArrowLeft=37; ArrowUp=38; ArrowRight=39; ArrowDown=40; 'Ctrl+F'=70}
            if (!$keyCodes.ContainsKey($state.key)) { throw 'Unsupported test key request.' }
            $keyCode = $keyCodes[$state.key]
            $keyValue = if ($state.key -eq 'Space') { ' ' } else { $state.key }
            $null = Invoke-PageCommand 'Page.bringToFront' @{}
            foreach ($keyType in @('keyDown', 'keyUp')) {
                $keyParams = @{type=$keyType; key=$keyValue; code=$state.key; windowsVirtualKeyCode=$keyCode}
                if ($state.key -eq 'Ctrl+F') { $keyParams.key = 'f'; $keyParams.code = 'KeyF'; $keyParams.modifiers = 2 }
                if ($keyType -eq 'keyDown' -and $state.key -in @('Enter', 'Space')) { $keyParams.text = if ($state.key -eq 'Enter') { "`r" } else { ' ' } }
                $null = Invoke-PageCommand 'Input.dispatchKeyEvent' $keyParams
            }
            $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='window.testKey = null'}
        }
        if ($state.pointer) {
            $p = $state.pointer
            if ($p.type -in @('mousePressed', 'mouseMoved', 'mouseReleased')) {
                $null = Invoke-PageCommand 'Input.dispatchMouseEvent' @{type=$p.type; x=[double]$p.x; y=[double]$p.y; button='left'; buttons=$(if ($p.type -eq 'mouseReleased') { 0 } else { 1 }); clickCount=1}
            } elseif ($p.type -in @('touchStart', 'touchMove', 'touchEnd', 'touchCancel')) {
                $points = @()
                if ($p.type -in @('touchStart', 'touchMove')) { $points = @(@{x=[double]$p.x; y=[double]$p.y; id=1}) }
                $null = Invoke-PageCommand 'Input.dispatchTouchEvent' @{type=$p.type; touchPoints=$points}
            } else { throw 'Unsupported test pointer request.' }
            $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='window.testPointer = null'}
        }
        if ($state.status -in @('passed', 'failed')) { break }
        if ([DateTime]::UtcNow -gt $deadline) { throw "Browser tests timed out. Last page: $($state.html)" }
        Start-Sleep -Milliseconds 100
    } while ($true)
    $dom = $state.html
    $result = [regex]::Match($dom, '<pre id="results" data-status="([^"]+)">([\s\S]*?)</pre>')
    if (!$result.Success) { throw "Browser produced no test result. $(Get-Content -Raw -LiteralPath $stderr)" }
    Write-Output ([System.Net.WebUtility]::HtmlDecode($result.Groups[2].Value))
    if ($result.Groups[1].Value -ne 'passed') { throw 'Browser assertions failed or did not finish.' }
    $expectedMatch = [regex]::Match($dom, '<pre id="export-expected"[^>]*data-json="([^"]+)"')
    if (!$expectedMatch.Success) { throw 'Missing expected export contents.' }
    $expected = [uri]::UnescapeDataString($expectedMatch.Groups[1].Value)
    $download = Join-Path $downloads 'text-blocks-backup.json'
    $downloadDeadline = [DateTime]::UtcNow.AddSeconds(5)
    while (!(Test-Path -LiteralPath $download)) {
        if ([DateTime]::UtcNow -gt $downloadDeadline) { throw 'The real JSON download was not created.' }
        Start-Sleep -Milliseconds 100
    }
    $actual = [IO.File]::ReadAllText($download)
    if ($actual -cne $expected) { throw 'Downloaded JSON differs from the entire collection, including filtered-out blocks.' }
    Write-Output 'PASS actual downloaded JSON matches all blocks, including filtered-out blocks'
    if ($CaptureFillReview -or $CapturePatternReview -or $CapturePaletteReview -or $CaptureOpacityReview) {
        $reviewFile = if ($CaptureOpacityReview) { 'opacity-visual.html' } elseif ($CapturePaletteReview) { 'palette-visual.html' } elseif ($CapturePatternReview) { 'pattern-visual.html' } else { 'fill-visual.html' }
        $artifactFile = if ($CaptureOpacityReview) { 'step35-opacity-review.png' } elseif ($CapturePaletteReview) { 'step34-palette-review.png' } elseif ($CapturePatternReview) { 'step33-pattern-review.png' } else { 'step32-fill-review.png' }
        $reviewPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot $reviewFile)).Path
        $null = Invoke-PageCommand 'Emulation.setDeviceMetricsOverride' @{width=1400; height=1400; deviceScaleFactor=1; mobile=$false}
        $reviewUrl = ([uri]$reviewPath).AbsoluteUri
        if ($CapturePaletteReview -or $CaptureOpacityReview) { $reviewUrl += '?isolatedReview=1' }
        $null = Invoke-PageCommand 'Page.navigate' @{url=$reviewUrl}
        $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='new Promise(resolve => setTimeout(resolve, 1000))'; awaitPromise=$true}
        $metrics = Invoke-PageCommand 'Page.getLayoutMetrics' @{}
        $shot = Invoke-PageCommand 'Page.captureScreenshot' @{format='png'; captureBeyondViewport=$true; clip=@{x=0; y=0; width=1400; height=$metrics.cssContentSize.height; scale=1}}
        $artifactDir = Join-Path $PSScriptRoot 'artifacts'
        New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
        [IO.File]::WriteAllBytes((Join-Path $artifactDir $artifactFile), [Convert]::FromBase64String($shot.data))
        Write-Output "Saved tests/artifacts/$artifactFile"
    }
    if ($CaptureWorkspaceReview) {
        $appUrl = ([uri](Resolve-Path (Join-Path $PSScriptRoot '../index.html')).Path).AbsoluteUri
        $null = Invoke-PageCommand 'Page.navigate' @{url=$appUrl}
        $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='new Promise(r=>setTimeout(r,300))'; awaitPromise=$true}
        $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='localStorage.setItem("textBlocks",JSON.stringify(Array.from({length:9},(_,i)=>({title:["Project notes","Useful links","Next steps"][i%3],text:"Keep useful text close at hand. Edit each block in place and copy exactly what you need.",tags:["work","ideas"],color:["#EAF1F8","#F2EADB","#E6F0E8"][i%3]}))));localStorage.setItem("surfaceColor","#FFFFFF");localStorage.setItem("preferredColor","#F0F0F0");localStorage.setItem("preferredColumns","3");localStorage.setItem("actionIconMode","false");location.reload()'}
        $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='new Promise(r=>setTimeout(r,300))'; awaitPromise=$true}
        foreach ($size in @(@(1200,800),@(1920,1080),@(768,1024),@(320,800))) {
            $null = Invoke-PageCommand 'Emulation.setDeviceMetricsOverride' @{width=$size[0]; height=$size[1]; deviceScaleFactor=1; mobile=$false}
            $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='window.scrollTo(0,0);new Promise(r=>setTimeout(r,200))'; awaitPromise=$true}
            $shot = Invoke-PageCommand 'Page.captureScreenshot' @{format='png'; captureBeyondViewport=$false}
            $artifactDir = Join-Path $PSScriptRoot 'artifacts'
            New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
            [IO.File]::WriteAllBytes((Join-Path $artifactDir "step30-$CaptureWorkspaceReview-$($size[0]).png"), [Convert]::FromBase64String($shot.data))
        }
        if ($CaptureWorkspaceReview -eq 'final') {
            $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='localStorage.removeItem("copyblocks.connectFour.v1");localStorage.setItem("textBlocks",JSON.stringify(JSON.parse(localStorage.getItem("textBlocks")).slice(0,2)));location.reload()'}
            $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='new Promise(r=>setTimeout(r,300))'; awaitPromise=$true}
            $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='document.querySelector(".utilities-menu").open=true;document.querySelector("#connect-four-toggle").click();document.querySelector(".utilities-menu").open=false;document.querySelector("[data-label=Edit]").click();document.querySelector("[data-component=color]").click();document.querySelector("#note-fill-style").value="dots";document.querySelector("#note-fill-style").dispatchEvent(new Event("change"));document.querySelector("#color-opacity-value-0").value="50";document.querySelector("#color-opacity-value-0").dispatchEvent(new Event("input"))'}
            foreach ($width in @(1200,320)) {
                $null = Invoke-PageCommand 'Emulation.setDeviceMetricsOverride' @{width=$width; height=2200; deviceScaleFactor=1; mobile=$false}
                $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='window.scrollTo(0,0);new Promise(r=>setTimeout(r,250))'; awaitPromise=$true}
                $shot = Invoke-PageCommand 'Page.captureScreenshot' @{format='png'; captureBeyondViewport=$false}
                [IO.File]::WriteAllBytes((Join-Path $artifactDir "step31-edit-game-$width.png"), [Convert]::FromBase64String($shot.data))
            }
        }
    }
    Write-Output 'SUCCESS: browser assertions and download verification passed.'
    $exitCode = 0
} catch {
    Write-Error -ErrorAction Continue $_
    $exitCode = 1
} finally {
    if ($socket) { $socket.Dispose() }
    if ($browserProcess -and !$browserProcess.HasExited) { $browserProcess.Kill() }
    # Delete only this run's generated directory after checking its resolved parent/name.
    if (Test-Path -LiteralPath $runRoot) {
        $resolved = (Resolve-Path -LiteralPath $runRoot).Path
        $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/')
        if ([IO.Path]::GetDirectoryName($resolved).TrimEnd('\', '/') -eq $tempRoot -and
            [IO.Path]::GetFileName($resolved) -match '^copyblocks-tests-[a-f0-9]{32}$') {
            Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}
exit $exitCode



