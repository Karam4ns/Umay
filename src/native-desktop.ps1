param([System.IO.TextReader]$RequestReader=$null,[System.IO.TextWriter]$ResponseWriter=$null,[bool]$RequireAdministrator=$false)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
if($null -eq $RequestReader){$RequestReader=[Console]::In};if($null -eq $ResponseWriter){$ResponseWriter=[Console]::Out}
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$administrator=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if($RequireAdministrator -and -not $administrator){throw 'NATIVE_ELEVATION_REQUIRED'}
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Threading;
using System.Collections.Generic;
public static class UmayInput {
 [StructLayout(LayoutKind.Sequential)] public struct Point {public int X;public int Y;}
 [StructLayout(LayoutKind.Sequential)] public struct Mouse {public int dx,dy;public uint data,flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Sequential)] public struct Keyboard {public ushort vk,scan;public uint flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Explicit)] public struct Union {[FieldOffset(0)]public Mouse mouse;[FieldOffset(0)]public Keyboard keyboard;}
 [StructLayout(LayoutKind.Sequential)] public struct Input {public uint type;public Union u;}
 [DllImport("user32.dll")] static extern uint SendInput(uint count,Input[] inputs,int size);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder value,int length);
 [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 public delegate bool WindowEnum(IntPtr window,IntPtr parameter);
 [DllImport("user32.dll")] static extern bool EnumWindows(WindowEnum callback,IntPtr parameter);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
 [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr window,int command);
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
 public class WindowInfo {public long handle;public string title;public bool minimized;}
 public static WindowInfo[] Windows(){var result=new List<WindowInfo>();EnumWindows((window,p)=>{if(IsWindowVisible(window)){var text=new StringBuilder(1024);GetWindowText(window,text,text.Capacity);if(text.Length>0)result.Add(new WindowInfo{handle=window.ToInt64(),title=text.ToString(),minimized=IsIconic(window)});}return result.Count<80;},IntPtr.Zero);return result.ToArray();}
 public static void Focus(long handle){var window=new IntPtr(handle);if(!IsWindow(window)||!IsWindowVisible(window))throw new Exception("NATIVE_WINDOW_UNAVAILABLE");if(IsIconic(window))ShowWindowAsync(window,9);SetForegroundWindow(window);for(int i=0;i<12;i++){if(GetForegroundWindow()==window)return;Thread.Sleep(25);}throw new Exception("NATIVE_WINDOW_UNAVAILABLE");}
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint processId);
 [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access,bool inherit,uint processId);
 [DllImport("advapi32.dll")] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll")] static extern bool GetTokenInformation(IntPtr token,int type,out uint information,int length,out int returned);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 public static bool? ElevatedWindow(IntPtr window){uint processId;GetWindowThreadProcessId(window,out processId);if(processId==0)return null;IntPtr process=OpenProcess(0x1000,false,processId),token=IntPtr.Zero;try{if(process==IntPtr.Zero||!OpenProcessToken(process,8,out token))return null;uint elevated;int length;if(!GetTokenInformation(token,20,out elevated,4,out length))return null;return elevated!=0;}finally{if(token!=IntPtr.Zero)CloseHandle(token);if(process!=IntPtr.Zero)CloseHandle(process);}}
 public static string Title(){var text=new StringBuilder(1024);GetWindowText(GetForegroundWindow(),text,text.Capacity);return text.ToString();}
 static void Send(Input[] inputs){uint sent=SendInput((uint)inputs.Length,inputs,Marshal.SizeOf(typeof(Input)));if(sent!=inputs.Length)throw new Exception(sent>0?"NATIVE_PARTIAL_INPUT":"NATIVE_INPUT_DENIED");}
 static Input Key(ushort key,bool up){return new Input{type=1,u=new Union{keyboard=new Keyboard{vk=key,flags=up?2u:0u}}};}
 static Input Unicode(char character,bool up){return new Input{type=1,u=new Union{keyboard=new Keyboard{scan=character,flags=4u|(up?2u:0u)}}};}
 static Input Button(uint flag,uint data=0){return new Input{type=0,u=new Union{mouse=new Mouse{flags=flag,data=data}}};}
 public static void Click(int x,int y,string button,int count){SetCursorPos(x,y);uint down=button=="right"?8u:button=="middle"?32u:2u,up=down*2;for(int i=0;i<count;i++){try{Send(new[]{Button(down),Button(up)});}catch(Exception error){try{Send(new[]{Button(up)});}catch{}throw new Exception(i>0||error.Message=="NATIVE_PARTIAL_INPUT"?"NATIVE_PARTIAL_INPUT":error.Message);}if(count>1)Thread.Sleep(90);}}
 public static void Scroll(int amount,bool horizontal){Send(new[]{Button(horizontal?0x1000u:0x0800u,unchecked((uint)(amount*120)))});}
 public static void Drag(int x,int y,int endX,int endY){SetCursorPos(x,y);Send(new[]{Button(2)});try{for(int i=1;i<=12;i++){SetCursorPos(x+(endX-x)*i/12,y+(endY-y)*i/12);Thread.Sleep(15);}}finally{try{Send(new[]{Button(4)});}catch{throw new Exception("NATIVE_PARTIAL_INPUT");}}}
 public static void Chord(ushort[] keys){int pressed=0;Exception failure=null;try{for(;pressed<keys.Length;pressed++)Send(new[]{Key(keys[pressed],false)});}catch(Exception error){failure=error;}finally{for(int i=pressed-1;i>=0;i--){try{Send(new[]{Key(keys[i],true)});}catch(Exception error){if(failure==null)failure=error;}}}if(failure!=null)throw new Exception(pressed>0||failure.Message=="NATIVE_PARTIAL_INPUT"?"NATIVE_PARTIAL_INPUT":failure.Message);}
 public static void Text(string text){int written=0;foreach(char ch in text){if(ch=='\r')continue;try{if(ch=='\n'){Chord(new ushort[]{13});}else if(ch=='\t'){Chord(new ushort[]{9});}else Send(new[]{Unicode(ch,false),Unicode(ch,true)});written++;}catch(Exception error){if(error.Message=="NATIVE_PARTIAL_INPUT"){try{Send(new[]{Unicode(ch,true)});}catch{}}throw new Exception(written>0||error.Message=="NATIVE_PARTIAL_INPUT"?"NATIVE_PARTIAL_INPUT":error.Message);}}}
}
'@
[void][UmayInput]::SetProcessDpiAwarenessContext([IntPtr](-4))
function Get-Observation {
 $handle=[UmayInput]::GetForegroundWindow().ToInt64()
 if($handle -eq 0){throw 'NATIVE_DESKTOP_LOCKED'}
 $targetElevated=[UmayInput]::ElevatedWindow([IntPtr]$handle)
 if($targetElevated -eq $true -and -not $administrator){return @{title=[UmayInput]::Title();handle=$handle;administrator=$false;requiresElevation=$true;elements=@();windows=@()}}
 $root=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$handle)
 $walker=[System.Windows.Automation.TreeWalker]::ControlViewWalker
 if($null -ne $root){while($null -ne $walker.GetParent($root) -and $walker.GetParent($root) -ne [System.Windows.Automation.AutomationElement]::RootElement){$root=$walker.GetParent($root)}}
 $items=New-Object System.Collections.Generic.List[object]
 if($null -ne $root){
  $queue=New-Object System.Collections.Generic.Queue[object];$queue.Enqueue(@($root,0))
  while($queue.Count -gt 0 -and $items.Count -lt 160){
   $pair=$queue.Dequeue();$element=$pair[0];$depth=$pair[1]
   try{
    $p=$element.Current
    if(-not $p.IsOffscreen -and -not $p.IsPassword){
     $rectangle=$p.BoundingRectangle;$name=[string]$p.Name
     if($name.Length -gt 350){$name=$name.Substring(0,350)}
     if($rectangle.Width -gt 0 -and $rectangle.Height -gt 0){
      $value='';$pattern=$null
      if($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$pattern)){$value=[string]$pattern.Current.Value;if($value.Length -gt 600){$value=$value.Substring(0,600)}}
      $items.Add(@{id=$items.Count;name=$name;value=$value;type=$p.ControlType.ProgrammaticName;automationId=$p.AutomationId;bounds=@{x=$rectangle.X;y=$rectangle.Y;width=$rectangle.Width;height=$rectangle.Height}})
     }
    }
    if($depth -lt 8){$child=$walker.GetFirstChild($element);$count=0;while($null -ne $child -and $count -lt 100){$queue.Enqueue(@($child,$depth+1));$child=$walker.GetNextSibling($child);$count++}}
   }catch{}
  }
 }
 $point=New-Object UmayInput+Point;[void][UmayInput]::GetCursorPos([ref]$point)
 if($handle -ne [UmayInput]::GetForegroundWindow().ToInt64()){throw 'NATIVE_FOCUS_CHANGED'}
 return @{title=[UmayInput]::Title();handle=$handle;administrator=$administrator;requiresElevation=$false;windows=[UmayInput]::Windows();elements=$items.ToArray();cursor=@{x=$point.X;y=$point.Y}}
}
while($true){
 if($RequireAdministrator){$read=$RequestReader.ReadLineAsync();if(-not $read.Wait(240000)){break};$line=$read.Result}else{$line=$RequestReader.ReadLine()}
 if($null -eq $line){break}
 $request=$null
 try{
  $request=ConvertFrom-Json $line;$p=$request.params;$result=$true
  if($request.method -in @('click','move','drag','scroll','keys','text') -and $null -ne $p.expectedHandle -and [long]$p.expectedHandle -ne [UmayInput]::GetForegroundWindow().ToInt64()){throw 'NATIVE_FOCUS_CHANGED'}
  if($request.method -in @('click','move','drag','scroll','keys','text','focus') -and -not $administrator -and [UmayInput]::ElevatedWindow([UmayInput]::GetForegroundWindow()) -eq $true){throw 'NATIVE_ELEVATION_REQUIRED'}
  switch($request.method){
   'privileges' {$result=@{administrator=$administrator;pid=$PID}}
   'foreground' {$result=@{handle=[UmayInput]::GetForegroundWindow().ToInt64();title=[UmayInput]::Title();windows=[UmayInput]::Windows()}}
   'observe' {$result=Get-Observation}
   'click' {[UmayInput]::Click([int]$p.x,[int]$p.y,[string]$p.button,[int]$p.count)}
   'move' {[void][UmayInput]::SetCursorPos([int]$p.x,[int]$p.y)}
   'drag' {[UmayInput]::Drag([int]$p.x,[int]$p.y,[int]$p.endX,[int]$p.endY)}
   'scroll' {if($null -ne $p.x -and $null -ne $p.y){[void][UmayInput]::SetCursorPos([int]$p.x,[int]$p.y)};[UmayInput]::Scroll([int]$p.amount,($p.axis -eq 'horizontal'))}
   'focus' {[UmayInput]::Focus([long]$p.handle)}
   'keys' {[UmayInput]::Chord([uint16[]]$p.keys)}
   'text' {[UmayInput]::Text([string]$p.text)}
   'location' {
    Add-Type -AssemblyName System.Device
    $watcher=New-Object System.Device.Location.GeoCoordinateWatcher
    try{if(-not $watcher.TryStart($false,[TimeSpan]::FromSeconds(8)) -or $watcher.Position.Location.IsUnknown){throw 'LOCATION_UNAVAILABLE'};$position=$watcher.Position.Location;$result=@{latitude=$position.Latitude;longitude=$position.Longitude;accuracy=$position.HorizontalAccuracy;label='Cihaz konumu'}}finally{$watcher.Dispose()}
   }
   default {throw 'Bilinmeyen bilgisayar işlemi.'}
  }
   $ResponseWriter.WriteLine((ConvertTo-Json -Compress -Depth 8 @{id=$request.id;result=$result}))
 }catch{
  $nativeError=$_.Exception
  while($null -ne $nativeError.InnerException){$nativeError=$nativeError.InnerException}
  $errorMessage=[string]$nativeError.Message
  if($errorMessage -cnotmatch '^NATIVE_[A-Z_]+$'){$errorMessage=[string]$_.Exception.Message}
  $ResponseWriter.WriteLine((ConvertTo-Json -Compress -Depth 4 @{id=$request.id;error=$errorMessage}))
 }
}
