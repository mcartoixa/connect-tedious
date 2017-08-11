@ECHO OFF
::--------------------------------------------------------------------
:: Usage: "build [/clean | /build] [/log] [/NoPause] [/?]"
::
::                 /clean    - Cleans the project
::                 /build    - Builds the project
::
::                 /NoPause  - Does not pause after completion
::                 /?        - Gets the usage for this script
::--------------------------------------------------------------------



COLOR 07
SET CCNetLabel=0.0.0.0

:: Reset ERRORLEVEL
VERIFY OTHER 2>nul
SETLOCAL ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION
IF ERRORLEVEL 1 GOTO ERROR_EXT

SET NO_PAUSE=0
SET TARGET=build
SET DEV_BUILD=False
GOTO ARGS



:: -------------------------------------------------------------------
:: Builds the project
:: -------------------------------------------------------------------
:BUILD
IF "%TARGET%"=="Clean" (
    ::Yeah, really: https://github.com/isaacs/npm/issues/3697
    CALL rimraf.cmd node_modules
)

ECHO.
CALL npm.cmd install --loglevel info --cache tmp\npm-cache
IF ERRORLEVEL 1 GOTO END_ERROR
ECHO.
CALL npm.cmd run-script %TARGET% --dev
IF ERRORLEVEL 1 GOTO END_ERROR

GOTO END



:: -------------------------------------------------------------------
:: Parse command line argument values
:: Note: Currently, last one on the command line wins (ex: /rebuild /clean == /clean)
:: -------------------------------------------------------------------
:ARGS
IF "%PROCESSOR_ARCHITECTURE%"=="x86" (
    "C:\Windows\Sysnative\cmd.exe" /C "%0 %*"

    IF ERRORLEVEL 1 EXIT /B 1
    EXIT /B 0
)
::IF NOT "x%~5"=="x" GOTO ERROR_USAGE

:ARGS_PARSE
IF /I "%~1"=="/clean"      SET TARGET=Clean& SHIFT & GOTO ARGS_PARSE
IF /I "%~1"=="/build"      SET TARGET=build& SHIFT & GOTO ARGS_PARSE
IF /I "%~1"=="/test"       SET TARGET=test& SHIFT & GOTO ARGS_PARSE
IF /I "%~1"=="/NoPause"    SET NO_PAUSE=1& SHIFT & GOTO ARGS_PARSE
IF /I "%~1"=="/?"          GOTO ERROR_USAGE
IF    "%~1" EQU ""         GOTO ARGS_DONE
ECHO Unknown command-line switch: %~1
GOTO ERROR_USAGE

:ARGS_DONE
GOTO SETENV



:: -------------------------------------------------------------------
:: Set environment variables
:: -------------------------------------------------------------------
:SETENV
CALL :SetGitHomePathHelper > nul 2>&1
IF ERRORLEVEL 1 GOTO ERROR_GIT
ECHO SET GitHomePath=%GitHomePath%

CALL :SetNodeJsHomePathHelper > nul 2>&1
IF ERRORLEVEL 1 GOTO ERROR_NODEJS
ECHO SET NodeJsHomePath=%NodeJsHomePath%

SET PATH=%NodeJsHomePath%;%APPDATA%\npm;%GitHomePath%\bin;%PATH%
GOTO BUILD



:SetNodeJsHomePathHelper
SET NodeJsHomePath=
FOR /F "tokens=1,2*" %%i in ('REG QUERY HKEY_CURRENT_USER\Software\Node.js /V InstallPath') DO (
    IF "%%i"=="InstallPath" (
        SET "NodeJsHomePath=%%k"
    )
)
IF "%NodeJsHomePath%"=="" (
    FOR /F "tokens=1,2*" %%i in ('REG QUERY HKEY_LOCAL_MACHINE\SOFTWARE\Node.js /V InstallPath') DO (
        IF "%%i"=="InstallPath" (
            SET "NodeJsHomePath=%%k"
        )
    )
)
IF "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    IF "%NodeJsHomePath%"=="" (
        FOR /F "tokens=1,2*" %%i in ('REG QUERY HKEY_CURRENT_USER\Software\Wow6432Node\Node.js /V InstallPath') DO (
            IF "%%i"=="InstallPath" (
                SET "NodeJsHomePath=%%k"
            )
        )
    )
    IF "%NodeJsHomePath%"=="" (
        FOR /F "tokens=1,2*" %%i in ('REG QUERY HKEY_LOCAL_MACHINE\SOFTWARE\Wow6432Node\Node.js /V InstallPath') DO (
            IF "%%i"=="InstallPath" (
                SET "NodeJsHomePath=%%k"
            )
        )
    )
)
IF "%NodeJsHomePath%"=="" EXIT /B 1
EXIT /B 0



:SetGitHomePathHelper
SET GitHomePath=
FOR /F "tokens=1,2*" %%i in ('REG QUERY HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Git_is1 /V InstallLocation') DO (
    IF "%%i"=="InstallLocation" (
        SET "GitHomePath=%%k"
    )
)
IF "%GitHomePath%"=="" (
    FOR /F "tokens=1,2*" %%i in ('REG QUERY HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Git_is1 /V InstallLocation') DO (
        IF "%%i"=="InstallLocation" (
            SET "GitHomePath=%%k"
        )
    )
)
IF "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    IF "%GitHomePath%"=="" (
        FOR /F "tokens=1,2*" %%i in ('REG QUERY HKEY_CURRENT_USER\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Git_is1 /V InstallLocation') DO (
            IF "%%i"=="InstallLocation" (
                SET "GitHomePath=%%k"
            )
        )
    )
    IF "%GitHomePath%"=="" (
        FOR /F "tokens=1,2*" %%i in ('REG QUERY HKEY_LOCAL_MACHINE\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Git_is1 /V InstallLocation') DO (
            IF "%%i"=="InstallLocation" (
                SET "GitHomePath=%%k"
            )
        )
    )
)
IF "%GitHomePath%"=="" EXIT /B 1
EXIT /B 0



:: -------------------------------------------------------------------
:: Errors
:: -------------------------------------------------------------------
:ERROR_EXT
ECHO [31mCould not activate command extensions[0m
GOTO END

:ERROR_GIT
ECHO [31mCould not find Git[0m
GOTO END

:ERROR_NODEJS
ECHO [31mCould not find node.js[0m
GOTO END

:ERROR_USAGE
ECHO Usage: "build [/clean | /rebuild | /release] [/doc] [/log] [/NoPause] [/?]"
ECHO.
ECHO                 /clean    - Cleans the project
ECHO                 /rebuild  - Cleans and builds the project (default)
ECHO                 /release  - Rebuilds the project and performs additional operations
ECHO.
ECHO                 /doc      - Generates and packages the documentation (can be long)
ECHO                 /log      - Creates a detailed log for the build
ECHO.
ECHO                 /NoPause  - Does not pause after completion
ECHO                 /?        - Gets the usage for this script
GOTO END



:: -------------------------------------------------------------------
:: End
:: -------------------------------------------------------------------
:END_ERROR
COLOR 4E

:END
@IF NOT "%NO_PAUSE%"=="1" PAUSE
ENDLOCAL
