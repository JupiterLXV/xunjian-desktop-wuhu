param([ValidateSet('Prepare','Capture')][string]$Mode='Prepare',[string]$WindowHandle='0',[string]$Label='probe',[string]$OutputDirectory='taskbar-proof')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)] public struct PKey { public Guid fmtid; public uint pid; public PKey(uint id){fmtid=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");pid=id;} }
[StructLayout(LayoutKind.Explicit,Size=24)] public struct PValue { [FieldOffset(0)]public ushort vt; [FieldOffset(8)]public IntPtr ptr; [FieldOffset(8)]public uint number; }
[ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IProps {
 [PreserveSig]int GetCount(out uint n); [PreserveSig]int GetAt(uint n,out PKey key); [PreserveSig]int GetValue(ref PKey key,out PValue value); [PreserveSig]int SetValue(ref PKey key,ref PValue value); [PreserveSig]int Commit();
}
[StructLayout(LayoutKind.Sequential)] public struct Rect44 {public int Left,Top,Right,Bottom;}
public static class TaskbarNative44 {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr FindWindow(string c,string t);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out Rect44 r);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]public static extern IntPtr GetShellWindow();
 [DllImport("shell32.dll")]static extern int SHGetPropertyStoreForWindow(IntPtr h,ref Guid iid,[MarshalAs(UnmanagedType.Interface)]out IProps store);
 [DllImport("ole32.dll")]static extern int PropVariantClear(ref PValue value);
 public static Dictionary<string,object> ReadProperties(IntPtr h){
  Guid iid=typeof(IProps).GUID;IProps store;Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(h,ref iid,out store));
  var d=new Dictionary<string,object>();string[] names={"RelaunchCommand","RelaunchIconResource","RelaunchDisplayNameResource","AppUserModelID"};
  try{for(uint i=0;i<4;i++){var key=new PKey(i+2);PValue v;Marshal.ThrowExceptionForHR(store.GetValue(ref key,out v));try{d[names[i]]=v.vt==31?(object)Marshal.PtrToStringUni(v.ptr):v.vt==0?null:(object)("VT="+v.vt+" value="+v.number);}finally{PropVariantClear(ref v);}}}finally{Marshal.ReleaseComObject(store);}return d;
 }
}
'@
$session=[Diagnostics.Process]::GetCurrentProcess().SessionId
$tray=[TaskbarNative44]::FindWindow('Shell_TrayWnd',$null)
if($Mode -eq 'Prepare' -and $tray -eq [IntPtr]::Zero -and $session -ne 0){
 Start-Process "$env:WINDIR\explorer.exe"
 $until=[DateTime]::UtcNow.AddSeconds(20)
 do{Start-Sleep -Milliseconds 250;$tray=[TaskbarNative44]::FindWindow('Shell_TrayWnd',$null)}while($tray -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $until)
}
$bounds=New-Object Rect44
$null=[TaskbarNative44]::GetWindowRect($tray,[ref]$bounds)
$ready=$session -ne 0 -and $tray -ne [IntPtr]::Zero -and [TaskbarNative44]::IsWindowVisible($tray) -and $bounds.Right -gt $bounds.Left
$result=[ordered]@{label=$Label;sessionId=$session;explorerTaskbarPresent=$ready;taskbarHandle=$tray.ToInt64().ToString();properties=$null;buttons=@();captures=@();error=$null}
if($Mode -eq 'Capture'){
 $result.properties=[TaskbarNative44]::ReadProperties([IntPtr]::new([Int64]::Parse($WindowHandle)))
 if($ready){
  try{
   New-Item -ItemType Directory -Path $OutputDirectory -Force|Out-Null
   function Capture-Rect([int]$X,[int]$Y,[int]$W,[int]$H,[string]$File){
    if($W -lt 1 -or $H -lt 1 -or $W -gt 5000 -or $H -gt 3000){throw 'Invalid screenshot geometry'}
    $bitmap=New-Object System.Drawing.Bitmap($W,$H);$g=[Drawing.Graphics]::FromImage($bitmap)
    try{$g.CopyFromScreen($X,$Y,0,0,[Drawing.Size]::new($W,$H));$bitmap.Save($File,[Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$bitmap.Dispose()}
   }
   $strip=Join-Path $OutputDirectory "$Label-taskbar.png"
   Capture-Rect $bounds.Left $bounds.Top ($bounds.Right-$bounds.Left) ($bounds.Bottom-$bounds.Top) $strip
   $result.captures+= $strip
   $root=[Windows.Automation.AutomationElement]::FromHandle($tray)
   $elements=$root.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
   foreach($element in $elements){$p=$element.Current;$r=$p.BoundingRectangle;if($p.Name -match 'Xunjian|巡检' -and !$r.IsEmpty -and $r.Width -ge 20 -and $r.Height -ge 20){$result.buttons+=@{name=$p.Name;class=$p.ClassName;automationId=$p.AutomationId;x=$r.X;y=$r.Y;w=$r.Width;h=$r.Height}}}
   $button=$result.buttons|Sort-Object {$_.w*$_.h}|Select-Object -First 1
   if($button){$crop=Join-Path $OutputDirectory "$Label-button.png";Capture-Rect ([int]$button.x) ([int]$button.y) ([int]$button.w) ([int]$button.h) $crop;$result.captures+=$crop}
  }catch{$result.error=$_.Exception.Message}
 }else{$result.error='No visible Explorer taskbar on an interactive Windows desktop; visual verification unavailable'}
}
$result|ConvertTo-Json -Depth 8 -Compress
