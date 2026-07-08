Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

If Not FSO.FileExists(".env") Then
  If FSO.FileExists(".env.example") Then
    WshShell.Run "cmd /c copy .env.example .env", 0, True
  End If
End If

If Not FSO.FolderExists("node_modules") Then
  WshShell.Run "cmd /k npm install && timeout /t 2", 1, True
End If

If Not FSO.FolderExists("data\uploads") Then FSO.CreateFolder("data\uploads")
If Not FSO.FolderExists("data\logs") Then FSO.CreateFolder("data\logs")

port = "3000"
If FSO.FileExists(".env") Then
  Set f = FSO.OpenTextFile(".env", 1)
  Do While Not f.AtEndOfStream
    line = f.ReadLine
    If Left(line, 5) = "PORT=" Then port = Mid(line, 6)
  Loop
  f.Close
End If

WshShell.Run "cmd /c npm run build", 0, True
WshShell.Run "cmd /c node src/backend/server.js", 0, False
WScript.Sleep 5000
WshShell.Run "http://localhost:" & port
