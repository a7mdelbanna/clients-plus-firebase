@echo off
cd functions
call npm run build
cd ..
firebase deploy --only functions