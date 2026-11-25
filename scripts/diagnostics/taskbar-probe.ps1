# Standalone, reversible Windows taskbar probe. No installer, registry writes or cache resets.
$ErrorActionPreference='Stop'
$automatic=$env:XUNJIAN_TASKBAR_PROBE_AUTOMATIC -eq '1'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)] public struct ProbeKey { public Guid fmtid; public uint pid; public ProbeKey(uint id){fmtid=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");pid=id;} }
[StructLayout(LayoutKind.Explicit,Size=24)] public struct ProbeValue { [FieldOffset(0)]public ushort vt; [FieldOffset(8)]public IntPtr ptr; }
[ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface ProbeStore {
 [PreserveSig]int GetCount(out uint n); [PreserveSig]int GetAt(uint n,out ProbeKey key); [PreserveSig]int GetValue(ref ProbeKey key,out ProbeValue value); [PreserveSig]int SetValue(ref ProbeKey key,ref ProbeValue value); [PreserveSig]int Commit();
}
[StructLayout(LayoutKind.Sequential)] public struct ProbeRect {public int Left,Top,Right,Bottom;}
public static class XunjianTaskbarProbe {
 public delegate bool WindowCallback(IntPtr h,IntPtr p);
 [DllImport("user32.dll")]static extern bool EnumWindows(WindowCallback cb,IntPtr p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr h,System.Text.StringBuilder s,int n);
 [DllImport("user32.dll")]public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out ProbeRect r);
 [DllImport("user32.dll")]public static extern IntPtr SendMessageTimeout(IntPtr h,uint m,IntPtr w,IntPtr l,uint flags,uint timeout,out IntPtr result);
 [DllImport("user32.dll",EntryPoint="GetClassLongPtrW")]static extern IntPtr GetClassLong64(IntPtr h,int n);
 [DllImport("user32.dll",EntryPoint="GetClassLongW")]static extern uint GetClassLong32(IntPtr h,int n);
 [DllImport("shell32.dll")]static extern int SHGetPropertyStoreForWindow(IntPtr h,ref Guid iid,[MarshalAs(UnmanagedType.Interface)]out ProbeStore store);
 [DllImport("ole32.dll")]static extern int PropVariantClear(ref ProbeValue value);
 static readonly string[] Names={"RelaunchCommand","RelaunchIconResource","RelaunchDisplayNameResource","AppUserModelID"};
 static ProbeStore Open(IntPtr h){Guid iid=typeof(ProbeStore).GUID;ProbeStore s;Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(h,ref iid,out s));return s;}
 public static Dictionary<string,string> Read(IntPtr h){
  var s=Open(h);var d=new Dictionary<string,string>();try{for(uint i=0;i<4;i++){var k=new ProbeKey(i+2);ProbeValue v;Marshal.ThrowExceptionForHR(s.GetValue(ref k,out v));try{if(v.vt!=0&&v.vt!=31)throw new InvalidOperationException("Unsupported property type; refusing to change window: "+v.vt);d[Names[i]]=v.vt==0?null:Marshal.PtrToStringUni(v.ptr);}finally{PropVariantClear(ref v);}}}finally{Marshal.ReleaseComObject(s);}return d;
 }
 public static void Write(IntPtr h,string command,string icon,string name,string appId){
  var s=Open(h);var values=new string[]{command,icon,name,appId};try{for(uint i=0;i<4;i++){var k=new ProbeKey(i+2);var v=new ProbeValue();try{if(values[i]!=null){v.vt=31;v.ptr=Marshal.StringToCoTaskMemUni(values[i]);}Marshal.ThrowExceptionForHR(s.SetValue(ref k,ref v));}finally{PropVariantClear(ref v);}}Marshal.ThrowExceptionForHR(s.Commit());}finally{Marshal.ReleaseComObject(s);}
 }
 public static void Restore(IntPtr h,Dictionary<string,string> original){Write(h,original[Names[0]],original[Names[1]],original[Names[2]],original[Names[3]]);}
 public static Dictionary<string,long> Icons(IntPtr h){var d=new Dictionary<string,long>();for(int i=0;i<3;i++){IntPtr result;SendMessageTimeout(h,0x7f,new IntPtr(i),IntPtr.Zero,2,1500,out result);d["WM_GETICON_"+i]=result.ToInt64();}foreach(int i in new int[]{-14,-34})d["class_"+i]=(IntPtr.Size==8?GetClassLong64(h,i):new IntPtr((long)GetClassLong32(h,i))).ToInt64();return d;}
 public static IntPtr[] Taskbars(){var list=new List<IntPtr>();EnumWindows(delegate(IntPtr h,IntPtr p){var s=new System.Text.StringBuilder(128);GetClassName(h,s,128);if(s.ToString()=="Shell_TrayWnd"||s.ToString()=="Shell_SecondaryTrayWnd")list.Add(h);return true;},IntPtr.Zero);return list.ToArray();}
}
'@
function Read-AsarFile([string]$Archive,[string]$Relative){
 $stream=[IO.File]::OpenRead($Archive)
 try{
  $reader=New-Object IO.BinaryReader($stream)
  if($reader.ReadUInt32() -ne 4){throw 'Unsupported ASAR size header'}
  $headerSize=$reader.ReadUInt32();if($headerSize -lt 8 -or $headerSize -gt 33554432){throw 'Invalid ASAR header size'}
  $bytes=$reader.ReadBytes([int]$headerSize);$length=[BitConverter]::ToInt32($bytes,4)
  if($length -lt 2 -or $length -gt $bytes.Length-8){throw 'Invalid ASAR JSON length'}
  $header=[Text.Encoding]::UTF8.GetString($bytes,8,$length)|ConvertFrom-Json
  $entry=$header;foreach($part in $Relative.Split('/')){$entry=$entry.files.$part;if(!$entry){throw "Missing ASAR entry: $Relative"}}
  if($entry.unpacked -or $entry.link -or $entry.size -gt 2097152){throw "Unsupported ASAR entry: $Relative"}
  $null=$stream.Seek(8+[int64]$headerSize+[int64]$entry.offset,[IO.SeekOrigin]::Begin)
  $result=$reader.ReadBytes([int]$entry.size);if($result.Length -ne $entry.size){throw 'Incomplete ASAR file'}
  return ,$result
 }finally{$stream.Dispose()}
}
function Snapshot-Icons([string]$Label){
 $result=@();$handles=[XunjianTaskbarProbe]::Icons($window)
 foreach($key in $handles.Keys){
  $handle=$handles[$key];$row=[ordered]@{kind=$key;handle=$handle;file=$null;error=$null}
  if($handle){try{$borrowed=[Drawing.Icon]::FromHandle([IntPtr]::new($handle));$copy=$borrowed.Clone();try{$bitmap=$copy.ToBitmap();try{$file=Join-Path $outDir "$Label-$key.png";$bitmap.Save($file,[Drawing.Imaging.ImageFormat]::Png);$row.file=[IO.Path]::GetFileName($file);$row.width=$bitmap.Width;$row.height=$bitmap.Height}finally{$bitmap.Dispose()}}finally{$copy.Dispose()}}catch{$row.error=$_.Exception.Message}}
  $result+= [pscustomobject]$row
 }
 return $result
}
function Snapshot-Taskbars([string]$Label){
 $result=@();$index=0
 foreach($tray in [XunjianTaskbarProbe]::Taskbars()){
  $rect=New-Object ProbeRect;$null=[XunjianTaskbarProbe]::GetWindowRect($tray,[ref]$rect)
  $w=$rect.Right-$rect.Left;$h=$rect.Bottom-$rect.Top;$row=[ordered]@{handle=$tray.ToInt64();visible=[XunjianTaskbarProbe]::IsWindowVisible($tray);x=$rect.Left;y=$rect.Top;width=$w;height=$h;file=$null;error=$null}
  if($row.visible -and $w -gt 0 -and $h -gt 0 -and $w -le 16000 -and $h -le 16000 -and $w*$h -le 16000000){try{$bitmap=New-Object Drawing.Bitmap($w,$h);$g=[Drawing.Graphics]::FromImage($bitmap);try{$g.CopyFromScreen($rect.Left,$rect.Top,0,0,[Drawing.Size]::new($w,$h));$file=Join-Path $outDir "$Label-taskbar-$index.png";$bitmap.Save($file,[Drawing.Imaging.ImageFormat]::Png);$row.file=[IO.Path]::GetFileName($file)}finally{$g.Dispose();$bitmap.Dispose()}}catch{$row.error=$_.Exception.Message}}
  $result+= [pscustomobject]$row;$index++
 }
 return $result
}
function Read-Shortcuts {
 $result=@();$wsh=New-Object -ComObject WScript.Shell;$shell=New-Object -ComObject Shell.Application
 try{
  $roots=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'),[Environment]::GetFolderPath('StartMenu'),[Environment]::GetFolderPath('CommonStartMenu'))|Select-Object -Unique
  foreach($root in $roots){if(!$root){continue};foreach($file in @(Get-ChildItem -LiteralPath $root -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue|Where-Object {$_.Name -match '巡检|xunjian'})){
   try{$link=$wsh.CreateShortcut($file.FullName);$folder=$shell.NameSpace($file.DirectoryName);$item=$folder.ParseName($file.Name);$result+= [pscustomobject]@{path=$file.FullName;target=$link.TargetPath;targetExists=[IO.File]::Exists($link.TargetPath);arguments=$link.Arguments;iconLocation=$link.IconLocation;appUserModelId=$item.ExtendedProperty('System.AppUserModel.ID');modified=$file.LastWriteTimeUtc.ToString('o')}}catch{$result+=[pscustomobject]@{path=$file.FullName;error=$_.Exception.Message}}
  }}
 }finally{if($shell){$null=[Runtime.InteropServices.Marshal]::ReleaseComObject($shell)};if($wsh){$null=[Runtime.InteropServices.Marshal]::ReleaseComObject($wsh)}}
 return $result
}
function Record-Stage([string]$Label,[string]$Explanation){
 Start-Sleep -Milliseconds 2000
 if(![XunjianTaskbarProbe]::IsWindow($window)){throw 'Application window closed during test'}
 $row=[ordered]@{label=$Label;properties=[XunjianTaskbarProbe]::Read($window);icons=@(Snapshot-Icons $Label);taskbars=@(Snapshot-Taskbars $Label);userObserved='not-executed'}
 $script:report.stages+= [pscustomobject]$row
 if($automatic){return}
 $answer=[Windows.Forms.MessageBox]::Show("$Explanation`r`n`r`n请查看巡检程序此时的任务栏图标：`r`n是 = 原版 Logo 正常；否 = 仍是白纸；取消 = 停止测试。",'巡检任务栏图标对照',[Windows.Forms.MessageBoxButtons]::YesNoCancel,[Windows.Forms.MessageBoxIcon]::Question)
 $report.stages[-1].userObserved=$answer.ToString()
 if($answer -eq [Windows.Forms.DialogResult]::Cancel){throw [OperationCanceledException]::new('User cancelled taskbar comparison')}
}
$outDir=$env:XUNJIAN_TASKBAR_PROBE_OUTPUT
if(!$outDir){$outDir=Join-Path ([Environment]::GetFolderPath('Desktop')) ('Xunjian-Taskbar-Diagnostic-'+[DateTime]::Now.ToString('yyyyMMdd-HHmmss'))}
$null=New-Item -ItemType Directory -Path $outDir -Force
$report=[ordered]@{schema=1;created=[DateTime]::UtcNow.ToString('o');automatic=$automatic;sessionId=[Diagnostics.Process]::GetCurrentProcess().SessionId;windows=$null;process=$null;source=$null;shortcuts=@();stages=@();restored=$false;restoredProperties=$null;error=$null;restoreError=$null}
$original=$null;$window=[IntPtr]::Zero
try{
 $windows=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
 $report.windows=@{productName=$windows.ProductName;displayVersion=$windows.DisplayVersion;build=$windows.CurrentBuildNumber;revision=$windows.UBR;osVersion=[Environment]::OSVersion.VersionString;is64Bit=[Environment]::Is64BitOperatingSystem}
 $candidates=@(Get-Process -ErrorAction SilentlyContinue|Where-Object {$_.ProcessName -eq '巡检缺陷工具' -and $_.MainWindowHandle -ne [IntPtr]::Zero})
 if($candidates.Count -ne 1){throw "请先打开一个巡检程序主窗口，再双击本工具。当前检测到 $($candidates.Count) 个主窗口。"}
 $target=$candidates[0];$window=$target.MainWindowHandle;$exe=$target.Path
 $report.process=@{id=$target.Id;path=$exe;fileVersion=$target.FileVersion;title=$target.MainWindowTitle;windowHandle=$window.ToInt64();exeSha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash}
 $archive=Join-Path (Split-Path $exe) 'resources\app.asar'
 $pkg=[Text.Encoding]::UTF8.GetString((Read-AsarFile $archive 'package.json'))|ConvertFrom-Json
 $main=[Text.Encoding]::UTF8.GetString((Read-AsarFile $archive 'app/main.cjs'))
 $report.source=@{version=$pkg.version;asarSha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash;hasSetAppDetails=$main.Contains('win.setAppDetails(');hasProcessAppId=$main.Contains("app.setAppUserModelId('local.xunjian.desktop')")}
 $logo=Read-AsarFile $archive 'app/icon.ico';$iconFile=Join-Path $outDir 'original-logo.ico';[IO.File]::WriteAllBytes($iconFile,$logo)
 $iconHash=(Get-FileHash -LiteralPath $iconFile -Algorithm SHA256).Hash
 if($iconHash -ne '9ca78efce12395b0c827d1b92e3b0c25962f2f3a4bb2c81fc5b3bbee4c956745'){throw '图标与已验证的原版 Logo 不一致，已停止修改窗口属性。'}
 $report.source.iconSha256=$iconHash
 $report.shortcuts=@(Read-Shortcuts)
 $original=[XunjianTaskbarProbe]::Read($window)
 $report.originalProperties=$original
 if(!$automatic){$answer=[Windows.Forms.MessageBox]::Show('将对当前窗口做三阶段图标对照，并记录 Windows 版本、程序路径、快捷方式属性和任务栏区域截图。报告仅保存在本机桌面。测试结束会恢复窗口原属性；重新打开程序也会恢复默认行为。请保持巡检窗口打开。是否开始？','巡检任务栏诊断',[Windows.Forms.MessageBoxButtons]::OKCancel,[Windows.Forms.MessageBoxIcon]::Information);if($answer -ne [Windows.Forms.DialogResult]::OK){throw [OperationCanceledException]::new('User cancelled before changes')}}
 Record-Stage '0-baseline' '第 1/3 阶段：保留程序当前设置。'
 $command='"'+$exe+'"';$iconResource=$iconFile+',0'
 [XunjianTaskbarProbe]::Write($window,$command,$iconResource,'巡检缺陷工具','local.xunjian.desktop')
 Record-Stage '1-explicit-original-icon' '第 2/3 阶段：保留原应用身份，明确指定原版 Logo 文件。'
 $fresh='Local.Xunjian.TaskbarProbe.'+[DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
 [XunjianTaskbarProbe]::Write($window,$command,$iconResource,'巡检缺陷工具',$fresh)
 Record-Stage '2-fresh-window-identity' '第 3/3 阶段：使用新的临时窗口身份，仍使用同一份原版 Logo。'
}catch{$report.error=$_.Exception.Message;Write-Host $report.error}
finally{
 if($original -and [XunjianTaskbarProbe]::IsWindow($window)){
  try{[XunjianTaskbarProbe]::Restore($window,$original);$report.restoredProperties=[XunjianTaskbarProbe]::Read($window);$report.restored=$true;foreach($key in $original.Keys){if($original[$key] -cne $report.restoredProperties[$key]){$report.restored=$false;throw "Restored property mismatch: $key"}}}catch{$report.restoreError=$_.Exception.Message}
 }elseif($original){$report.restoreError='Application closed; temporary window properties ended with that window'}
 $json=Join-Path $outDir 'taskbar-report.json';$report|ConvertTo-Json -Depth 14|Set-Content -LiteralPath $json -Encoding UTF8
 $zip=$outDir+'.zip';if([IO.File]::Exists($zip)){Remove-Item -LiteralPath $zip};[IO.Compression.ZipFile]::CreateFromDirectory($outDir,$zip)
 Write-Output ('TASKBAR_PROBE_REPORT '+$json)
 if(!$automatic){$message="诊断已完成。请把桌面的这个 ZIP 发回：`r`n$zip";if($report.restoreError){$message+="`r`n窗口属性恢复未确认，请关闭并重新打开巡检程序。"};$null=[Windows.Forms.MessageBox]::Show($message,'巡检任务栏诊断');Start-Process explorer.exe -ArgumentList ('/select,"'+$zip+'"')}
}
if($report.error -or $report.restoreError){exit 1}
