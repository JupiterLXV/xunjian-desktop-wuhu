param([Parameter(Mandatory=$true)][string]$WindowHandle,[Parameter(Mandatory=$true)][string]$OriginalPng)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class XunjianWindowIcon {
 [DllImport("user32.dll", CharSet=CharSet.Unicode)]
 public static extern IntPtr SendMessage(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);
}
'@
$source = [System.Drawing.Bitmap]::FromFile($OriginalPng)
try {
 foreach ($kind in @(0,1)) {
  $handle = [XunjianWindowIcon]::SendMessage([IntPtr]::new([Int64]::Parse($WindowHandle)),0x007F,[IntPtr]::new($kind),[IntPtr]::Zero)
  if ($handle -eq [IntPtr]::Zero) { throw "Window icon handle missing: $kind" }
  $icon = [System.Drawing.Icon]::FromHandle($handle)
  $actual = $icon.ToBitmap()
  $expected = New-Object System.Drawing.Bitmap($actual.Width,$actual.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($expected)
  try {
   $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
   $graphics.DrawImage($source,0,0,$expected.Width,$expected.Height)
   $errorSum = 0.0
   for($y=0;$y -lt $actual.Height;$y++) { for($x=0;$x -lt $actual.Width;$x++) {
    $a=$actual.GetPixel($x,$y);$b=$expected.GetPixel($x,$y)
    $errorSum += [Math]::Abs([int]$a.R-[int]$b.R)+[Math]::Abs([int]$a.G-[int]$b.G)+[Math]::Abs([int]$a.B-[int]$b.B)
   }}
   $mean = $errorSum / ($actual.Width*$actual.Height*3)
   if($mean -gt 35) { throw "Window icon differs from original PNG: kind=$kind mean=$mean" }
   Write-Output "Actual Windows icon verified: kind=$kind size=$($actual.Width)x$($actual.Height) mean-error=$mean"
  } finally {$graphics.Dispose();$expected.Dispose();$actual.Dispose();$icon.Dispose()}
 }
} finally {$source.Dispose()}
