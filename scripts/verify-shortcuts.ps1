param([Parameter(Mandatory=$true)][string]$InstallDirectory)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System.Runtime.InteropServices;
using System.Text;
public static class XunjianLongPath {
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
 public static extern uint GetLongPathName(string path, StringBuilder buffer, uint size);
}
'@
function Resolve-LongPath([string]$Value) {
 $buffer = New-Object System.Text.StringBuilder 32768
 if ([XunjianLongPath]::GetLongPathName($Value,$buffer,32768) -eq 0) { throw "Shortcut path is unavailable: $Value" }
 return $buffer.ToString()
}
$expected = Resolve-LongPath (Join-Path $InstallDirectory '巡检缺陷工具.exe')
$desktop = Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) '巡检缺陷工具.lnk'
$startRoot = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'
$start = Get-ChildItem $startRoot -Filter '巡检缺陷工具.lnk' -Recurse | Select-Object -First 1
if (!(Test-Path $desktop) -or !$start) { throw 'Desktop or Start Menu shortcut missing' }
$wsh = New-Object -ComObject WScript.Shell
$shell = New-Object -ComObject Shell.Application
foreach ($link in @($desktop, $start.FullName)) {
  $shortcut = $wsh.CreateShortcut($link)
  if ((Resolve-LongPath $shortcut.TargetPath) -ine $expected) { throw "Wrong shortcut target: $link actual=$($shortcut.TargetPath) expected=$expected" }
  if ($shortcut.IconLocation) {
    $iconPath = ($shortcut.IconLocation -replace ',\s*-?\d+$','').Trim('"')
    if ((Resolve-LongPath $iconPath) -ine $expected) { throw "Wrong shortcut icon location: $link" }
  }
  $folder = $shell.Namespace((Split-Path $link))
  $item = $folder.ParseName((Split-Path $link -Leaf))
  $appId = $item.ExtendedProperty('System.AppUserModel.ID')
  if ($appId -ne 'local.xunjian.desktop') { throw "Wrong shortcut AppUserModelID: $appId" }
}
Write-Output 'Desktop and Start Menu shortcut targets, icon sources and AppUserModelID verified'
