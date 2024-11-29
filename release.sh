#!/bin/bash

RELEASE_DIR=`$TMP`
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
SRC_ARR=("$SCRIPT_DIR/LICENSE" "$SCRIPT_DIR/src/common")
PACKAGE_CONTENT=''
if [ "$1" == "webservice" ]; then
    RELEASE_DIR=$RELEASE_DIR/jobman-server
    SRC_ARR+=("$SCRIPT_DIR/src/webservice")
    PACKAGE_CONTENT=`jq 'del(.dependencies.console-table-printer, .dependencies.marked, .dependencies.marked-terminal, .dependencies.zlib, .dependencies.compare-versions)' $SCRIPT_DIR/package.json`
elif [ "$1" == "client" ]; then
    RELEASE_DIR=$RELEASE_DIR/jobman-client
    SRC_ARR+=("$SCRIPT_DIR/examples.md" "$SCRIPT_DIR/usage.md" "$SCRIPT_DIR/src/client")
    PACKAGE_CONTENT=`jq 'del(.dependencies.@kubernetes/client-node, .dependencies.marked, )' $SCRIPT_DIR/package.json`
else
    echo "Usage: $0 {server|webservice}"
    exit
fi


mkdir -p $RELEASE_DIR
rm -rf $RELEASE_DIR/*

for toCopy in "${SRC_ARR[@]}"; do
    cp -r "$toCopy" $RELEASE_DIR
done

echo $PACKAGE_CONTENT > $RELEASE_DIR/package.json


