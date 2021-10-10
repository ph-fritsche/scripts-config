#!/bin/bash

SRC=$(readlink -f "${BASH_SOURCE[0]}")
DIR=$(dirname "$SRC")

cd "$DIR"

ret=0

for f in dist/esm/*.js dist/cjs/*.js build/*
do
    echo
    echo ------------------
    echo "$f:"
    nodeOut=$(node --experimental-specifier-resolution=node "./$f" 2>&1)
    nodeRet=$?

    echo $nodeOut
    if [[ "$f" == dist/cjs/consumerDeepEsm.js ]]
    then
        echo '^^^   Expected error as importing esm modules per "require" is not supported.'
        if [[ "$nodeRet" -eq 0 ]]
        then
            ((ret++))
        fi
    else
        ((ret+=$nodeRet))
    fi
done

echo 
echo ------------------
echo "exit with $ret"
exit $ret
