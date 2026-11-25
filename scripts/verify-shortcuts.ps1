param([Parameter(Mandatory=$true)][string]$InstallDirectory)
$ErrorActionPreference = 'Stop'
$expected = Join-Path $InstallDirectory '巡检缺陷工具.exe'
$desktop = Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) '巡检缺陷工具.lnk'
$startRoot = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'
$start = Get-ChildItem $startRoot -Filter '巡检缺陷工具.lnk' -Recurse | Select-Object -First 1
if (!(Test-Path $desktop) -or !$start) { throw 'Desktop or Start Menu shortcut missing' }
$wsh = New-Object -ComObject WScript.Shell
$shell = New-Object -ComObject Shell.Application
foreach ($link in @($desktop, $start.FullName)) {
  $shortcut = $wsh.CreateShortcut($link)
  if ($shortcut.TargetPath -ine $expected) { throw "Wrong shortcut target: $link" }
  if ($shortcut.IconLocation) {
    $iconPath = ($shortcut.IconLocation -replace ',\s*-?\d+$','').Trim('"')
    if ($iconPath -ine $expected) { throw "Wrong shortcut icon location: $link" }
  }
  $folder = $shell.Namespace((Split-Path $link))
  $item = $folder.ParseName((Split-Path $link -Leaf))
  $appId = $item.ExtendedProperty('System.AppUserModel.ID')
  if ($appId -ne 'local.xunjian.desktop') { throw "Wrong shortcut AppUserModelID: $appId" }
}
Write-Output 'Desktop and Start Menu shortcut targets, icon sources and AppUserModelID verified'
