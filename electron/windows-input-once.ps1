param(
  [Parameter(Mandatory = $true)]
  [string]$Action
)

$signature = @"
using System;
using System.Runtime.InteropServices;

public static class GestraInput {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@

Add-Type -TypeDefinition $signature -ErrorAction Stop

$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004
$MOUSEEVENTF_WHEEL = 0x0800
$KEYEVENTF_KEYUP = 0x0002
$VK_MEDIA_PLAY_PAUSE = 0xB3
$VK_SNAPSHOT = 0x2C
$VK_MENU = 0x12
$VK_TAB = 0x09
$WHEEL_DELTA = 120

switch ($Action.ToLowerInvariant()) {
  'scroll-up' {
    [GestraInput]::mouse_event($MOUSEEVENTF_WHEEL, 0, 0, [uint32](6 * $WHEEL_DELTA), [UIntPtr]::Zero)
    exit 0
  }
  'scroll-down' {
    [GestraInput]::mouse_event($MOUSEEVENTF_WHEEL, 0, 0, [uint32](-6 * $WHEEL_DELTA), [UIntPtr]::Zero)
    exit 0
  }
  'left-click' {
    [GestraInput]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
    [GestraInput]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
    exit 0
  }
  'play-pause' {
    [GestraInput]::keybd_event([byte]$VK_MEDIA_PLAY_PAUSE, 0, 0, [UIntPtr]::Zero)
    [GestraInput]::keybd_event([byte]$VK_MEDIA_PLAY_PAUSE, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    exit 0
  }
  'screenshot' {
    [GestraInput]::keybd_event([byte]$VK_SNAPSHOT, 0, 0, [UIntPtr]::Zero)
    [GestraInput]::keybd_event([byte]$VK_SNAPSHOT, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    exit 0
  }
  'alt-tab' {
    [GestraInput]::keybd_event([byte]$VK_MENU, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 40
    [GestraInput]::keybd_event([byte]$VK_TAB, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 40
    [GestraInput]::keybd_event([byte]$VK_TAB, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    [GestraInput]::keybd_event([byte]$VK_MENU, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    exit 0
  }
  default {
    Write-Error "Unsupported action: $Action"
    exit 1
  }
}
