$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Threading;
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
 public static string Title(){var text=new StringBuilder(1024);GetWindowText(GetForegroundWindow(),text,text.Capacity);return text.ToString();}
 static void Send(Input[] inputs){if(SendInput((uint)inputs.Length,inputs,Marshal.SizeOf(typeof(Input)))!=inputs.Length)throw new Exception("NATIVE_INPUT_DENIED");}
 static Input Key(ushort key,bool up){return new Input{type=1,u=new Union{keyboard=new Keyboard{vk=key,flags=up?2u:0u}}};}
 static Input Unicode(char character,bool up){return new Input{type=1,u=new Union{keyboard=new Keyboard{scan=character,flags=4u|(up?2u:0u)}}};}
 static Input Button(uint flag,uint data=0){return new Input{type=0,u=new Union{mouse=new Mouse{flags=flag,data=data}}};}
 public static void Click(int x,int y,string button,int count){SetCursorPos(x,y);uint down=button=="right"?8u:button=="middle"?32u:2u,up=down*2;for(int i=0;i<count;i++){Send(new[]{Button(down),Button(up)});if(count>1)Thread.Sleep(90);}}
 public static void Scroll(int amount){Send(new[]{Button(0x0800,unchecked((uint)(amount*120)))});}
 public static void Drag(int x,int y,int endX,int endY){SetCursorPos(x,y);Send(new[]{Button(2)});try{for(int i=1;i<=12;i++){SetCursorPos(x+(endX-x)*i/12,y+(endY-y)*i/12);Thread.Sleep(15);}}finally{Send(new[]{Button(4)});}}
 public static void Chord(ushort[] keys){int pressed=0;try{for(;pressed<keys.Length;pressed++)Send(new[]{Key(keys[pressed],false)});}finally{for(int i=pressed-1;i>=0;i--)Send(new[]{Key(keys[i],true)});}}
 public static void Text(string text){foreach(char ch in text){if(ch=='\r')continue;if(ch=='\n'){Chord(new ushort[]{13});}else if(ch=='\t'){Chord(new ushort[]{9});}else Send(new[]{Unicode(ch,false),Unicode(ch,true)});}}
}
'@
[void][UmayInput]::SetProcessDpiAwarenessContext([IntPtr](-4))
function Get-Observation {
 $root=[System.Windows.Automation.AutomationElement]::FocusedElement
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
 return @{title=[UmayInput]::Title();handle=[UmayInput]::GetForegroundWindow().ToInt64();elements=$items.ToArray();cursor=@{x=$point.X;y=$point.Y}}
}
while($null -ne ($line=[Console]::ReadLine())){
 $request=$null
 try{
  $request=ConvertFrom-Json $line;$p=$request.params;$result=$true
  if($request.method -in @('click','move','drag','scroll','keys','text') -and $null -ne $p.expectedHandle -and [long]$p.expectedHandle -ne [UmayInput]::GetForegroundWindow().ToInt64()){throw 'NATIVE_FOCUS_CHANGED'}
  switch($request.method){
   'observe' {$result=Get-Observation}
   'click' {[UmayInput]::Click([int]$p.x,[int]$p.y,[string]$p.button,[int]$p.count)}
   'move' {[void][UmayInput]::SetCursorPos([int]$p.x,[int]$p.y)}
   'drag' {[UmayInput]::Drag([int]$p.x,[int]$p.y,[int]$p.endX,[int]$p.endY)}
   'scroll' {[UmayInput]::Scroll([int]$p.amount)}
   'keys' {[UmayInput]::Chord([uint16[]]$p.keys)}
   'text' {[UmayInput]::Text([string]$p.text)}
   'location' {
    Add-Type -AssemblyName System.Device
    $watcher=New-Object System.Device.Location.GeoCoordinateWatcher
    try{if(-not $watcher.TryStart($false,[TimeSpan]::FromSeconds(8)) -or $watcher.Position.Location.IsUnknown){throw 'LOCATION_UNAVAILABLE'};$position=$watcher.Position.Location;$result=@{latitude=$position.Latitude;longitude=$position.Longitude;accuracy=$position.HorizontalAccuracy;label='Cihaz konumu'}}finally{$watcher.Dispose()}
   }
   default {throw 'Bilinmeyen bilgisayar işlemi.'}
  }
  [Console]::WriteLine((ConvertTo-Json -Compress -Depth 8 @{id=$request.id;result=$result}))
 }catch{
  [Console]::WriteLine((ConvertTo-Json -Compress -Depth 4 @{id=$request.id;error=[string]$_.Exception.Message}))
 }
}
