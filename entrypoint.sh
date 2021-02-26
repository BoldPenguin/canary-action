#!/bin/sh -l

fixperms() {
    chown -R `stat --printf=%u /github/workspace/.` /github/workspace/*
}
trap fixperms EXIT

node /canary/lib/main.js
