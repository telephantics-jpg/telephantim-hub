@echo off
title Connect dual hub to telephantim.com
echo.
echo  Dual Mjolnir + Caduceus is READY on GitHub.
echo  telephantim.com still points at OLD Render until you click deploy.
echo.
echo  Opening Render dashboard - do this:
echo    1. Open service telephantim-hub
echo    2. Manual Deploy -^> Deploy latest commit
echo    3. Branch: master   Publish directory: (blank)
echo    4. Wait Live, hard-refresh https://telephantim.com
echo.
start "" "https://dashboard.render.com"
start "" "https://telephantics-jpg.github.io/telephantim-hub/"
start "" "https://telephantim.com"
echo.
pause
