' Hubly — Ticket System One-Click Launcher
' Double-click this file to start the app

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Set working directory to script location
scriptPath = Replace(WScript.ScriptFullName, WScript.ScriptName, "")
WshShell.CurrentDirectory = scriptPath

' Setup .env
If Not FSO.FileExists(".env") Then
  If FSO.FileExists(".env.example") Then
    WshShell.Run "cmd /c copy .env.example .env", 0, True
  End If
End If

' Install dependencies if needed
If Not FSO.FolderExists("node_modules") Then
  WshShell.Run "cmd /k npm install && timeout /t 2", 1, True
End If

' Create data directories
If Not FSO.FolderExists("data\uploads") Then FSO.CreateFolder("data\uploads")
If Not FSO.FolderExists("data\logs") Then FSO.CreateFolder("data\logs")

' Read port from .env
port = "3000"
If FSO.FileExists(".env") Then
  Set f = FSO.OpenTextFile(".env", 1)
  Do While Not f.AtEndOfStream
    line = f.ReadLine
    If Left(line, 5) = "PORT=" Then port = Mid(line, 6)
  Loop
  f.Close
End If

' Start both frontend (dev) and backend
WshShell.Run "cmd /c npm run dev", 0, False
WScript.Sleep 4000

' Open browser
WshShell.Run "http://localhost:5173"
