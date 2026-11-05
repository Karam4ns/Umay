# This bootstrap runs only after the user's genuine Windows runas/UAC consent.
# Configuration and the native script are immutable base64 in this invocation.
$ErrorActionPreference='Stop'
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=New-Object Security.Principal.WindowsPrincipal($identity)
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){exit 1}
$pipe=New-Object System.IO.Pipes.NamedPipeClientStream('.', $UmayPipe, [System.IO.Pipes.PipeDirection]::InOut, [System.IO.Pipes.PipeOptions]::None, [Security.Principal.TokenImpersonationLevel]::Anonymous)
try{
 $pipe.Connect(15000)
 $reader=New-Object System.IO.StreamReader($pipe,(New-Object System.Text.UTF8Encoding($false)))
 $writer=New-Object System.IO.StreamWriter($pipe,(New-Object System.Text.UTF8Encoding($false)))
 $writer.AutoFlush=$true
 $writer.WriteLine((ConvertTo-Json -Compress @{event='elevated-ready';token=$UmayToken;administrator=$true}))
 $accepted=ConvertFrom-Json $reader.ReadLine()
 if($accepted.event -ne 'accept' -or $accepted.token -cne $UmayToken){throw 'INVALID_ADMIN_SESSION'}
 $compressed=New-Object IO.MemoryStream(,[Convert]::FromBase64String($UmayNative))
 $gzip=New-Object IO.Compression.GZipStream($compressed,[IO.Compression.CompressionMode]::Decompress)
 $source=New-Object IO.StreamReader($gzip,[Text.Encoding]::UTF8)
 try{$script=$source.ReadToEnd()}finally{$source.Dispose();$gzip.Dispose();$compressed.Dispose()}
 & ([ScriptBlock]::Create($script)) -RequestReader $reader -ResponseWriter $writer -RequireAdministrator $true
}finally{$pipe.Dispose()}
