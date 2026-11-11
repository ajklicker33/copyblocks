param(
    [string]$BrowserPath,
    [switch]$ForceFailure
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
    $arguments = @('--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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
        $evaluation = Invoke-PageCommand 'Runtime.evaluate' @{expression='JSON.stringify({status:document.querySelector("#results")?.dataset.status, html:document.documentElement.outerHTML, key:window.testKey, motion:window.testMotion})'; returnByValue=$true}
        $state = $evaluation.result.value | ConvertFrom-Json
        if ($state.motion) {
            if ($state.motion -notin @('reduce', 'no-preference')) { throw 'Unsupported motion preference.' }
            $null = Invoke-PageCommand 'Emulation.setEmulatedMedia' @{features=@(@{name='prefers-reduced-motion'; value=$state.motion})}
            $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='window.testMotion = null'}
        }
        if ($state.key) {
            if ($state.key -notin @('Enter', 'Space', 'Tab')) { throw 'Unsupported test key request.' }
            $keyCode = if ($state.key -eq 'Enter') { 13 } elseif ($state.key -eq 'Tab') { 9 } else { 32 }
            $keyValue = if ($state.key -eq 'Space') { ' ' } else { $state.key }
            $null = Invoke-PageCommand 'Page.bringToFront' @{}
            foreach ($keyType in @('keyDown', 'keyUp')) {
                $keyParams = @{type=$keyType; key=$keyValue; code=$state.key; windowsVirtualKeyCode=$keyCode}
                if ($keyType -eq 'keyDown' -and $state.key -ne 'Tab') { $keyParams.text = if ($state.key -eq 'Enter') { "`r" } else { ' ' } }
                $null = Invoke-PageCommand 'Input.dispatchKeyEvent' $keyParams
            }
            $null = Invoke-PageCommand 'Runtime.evaluate' @{expression='window.testKey = null'}
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



