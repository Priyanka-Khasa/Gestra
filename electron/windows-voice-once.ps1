param(
  [int]$TimeoutSeconds = 8
)

$ErrorActionPreference = 'Stop'

try {
  Add-Type -AssemblyName System.Speech

  $culture = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
  $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
  $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $engine.SetInputToDefaultAudioDevice()

  $result = $engine.Recognize([TimeSpan]::FromSeconds($TimeoutSeconds))

  if ($null -eq $result) {
    [pscustomobject]@{
      ok = $false
      reason = 'timeout'
    } | ConvertTo-Json -Compress
    exit 0
  }

  $text = [string]$result.Text
  $confidence = [double]$result.Confidence
  [pscustomobject]@{
    ok = $true
    text = $text
    confidence = $confidence
  } | ConvertTo-Json -Compress
  exit 0
} catch {
  $message = $_.Exception.Message
  [pscustomobject]@{
    ok = $false
    reason = 'error'
    message = $message
  } | ConvertTo-Json -Compress
  exit 1
}
