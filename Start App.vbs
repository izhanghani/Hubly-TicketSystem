Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Create .env from example if missing
If Not FSO.FileExists(".env") Then
  If FSO.FileExists(".env.example") Then
    WshShell.Run "cmd /c copy .env.example .env", 0, True
  End If
End If

' Install dependencies if missing (show window so user sees progress)
If Not FSO.FolderExists("node_modules") Then
  WshShell.Run "cmd /k npm install && timeout /t 2", 1, True
End If

' Create data dirs
If Not FSO.FolderExists("data\uploads") Then
  FSO.CreateFolder("data\uploads")
End If
If Not FSO.FolderExists("data\logs") Then
  FSO.CreateFolder("data\logs")
End If

' Read port from .env
port = "3000"
If FSO.FileExists(".env") Then
  Set envFile = FSO.OpenTextFile(".env", 1)
  Do While Not envFile.AtEndOfStream
    line = envFile.ReadLine
    If Left(line, 5) = "PORT=" Then port = Mid(line, 6)
  Loop
  envFile.Close
End If

' Run the app in production mode (silent, no CMD window)
WshShell.Run "cmd /c scripts\start.bat", 0, False

' Wait a moment then open browser
WScript.Sleep 5000
WshShell.Run "http://localhost:" & port
