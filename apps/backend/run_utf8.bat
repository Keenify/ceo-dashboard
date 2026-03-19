@echo off
REM This batch file runs the FastAPI application using uvicorn with UTF-8 encoding

REM Set Python encoding to UTF-8
set PYTHONIOENCODING=utf-8

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Run uvicorn directly
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

REM Deactivate virtual environment on exit
call deactivate 