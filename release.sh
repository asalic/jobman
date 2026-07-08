#!/bin/sh

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
JOBMAN_VER=$(jq -r '.version' $SCRIPT_DIR/package.json)
RELEASE_DIR="$SCRIPT_DIR/build"
RELEASE_DIR_TMP="$RELEASE_DIR/jobman"
# SRC_ARR=(("$SCRIPT_DIR/LICENSE" "/") ("$SCRIPT_DIR/src/common" "/src") ("$SCRIPT_DIR/tsconfig.json" "/"))

rm -rf $RELEASE_DIR
mkdir -p $RELEASE_DIR_TMP/src $RELEASE_DIR_TMP/bin
cp -r $SCRIPT_DIR/tsconfig.json $SCRIPT_DIR/README.md $SCRIPT_DIR/LICENSE $RELEASE_DIR_TMP
cp -r $SCRIPT_DIR/src/common $RELEASE_DIR_TMP/src


if [ "$1" = "webservice" ]; then
    cp -r $SCRIPT_DIR/src/webservice $RELEASE_DIR_TMP/src
    # cp -r $SCRIPT_DIR/src/webserver/settings.json $RELEASE_DIR/settings.json
    # cp -r $SCRIPT_DIR/src/k8s-logger $RELEASE_DIR/src
    # cp $SCRIPT_DIR/bin/jobman-k8s-logger $SCRIPT_DIR/bin/jobman-webservice $RELEASE_DIR/bin
    cp $SCRIPT_DIR/bin/jobman-webservice $RELEASE_DIR_TMP/bin
    #RELEASE_DIR=$RELEASE_DIR/jobman-server
    # SRC_ARR+=(("$SCRIPT_DIR/src/webservice" "/src"))
    jq 'del(.dependencies."console-table-printer", .dependencies."marked", .dependencies."marked-terminal", .dependencies."zlib", .dependencies."compare-versions")' $SCRIPT_DIR/package.json > $RELEASE_DIR_TMP/package.json
elif [ "$1" = "client" ]; then
    #RELEASE_DIR=$RELEASE_DIR/jobman-client
    #SRC_ARR+=(("$SCRIPT_DIR/examples.md" "/") ("$SCRIPT_DIR/usage.md" "/") ("$SCRIPT_DIR/src/client" "$SCRIPT_DIR/bin/jobman")

    cp -r $SCRIPT_DIR/usage.md $SCRIPT_DIR/examples.md $RELEASE_DIR_TMP
    cp -r $SCRIPT_DIR/src/client $RELEASE_DIR_TMP/src
    # cp -r $SCRIPT_DIR/src/client/settings.json $RELEASE_DIR/dist/client/settings.json
    cp $SCRIPT_DIR/bin/jobman $RELEASE_DIR_TMP/bin
    jq 'del(.dependencies."@kubernetes/client-node", .dependencies."swagger-ui-express", .dependencies."swagger-jsdoc", .dependencies."jose", .dependencies."pino", .dependencies."pino-http", .dependencies."pino-pretty")' $SCRIPT_DIR/package.json > $RELEASE_DIR_TMP/package.json
else
    echo "Usage: $0 {client|webservice}"
    exit
fi

# for toCopy in "${SRC_ARR[@]}"; do
#     cp -r "$toCopy" $RELEASE_DIR
# done

cd $RELEASE_DIR_TMP
npm install
npx tsc
rm -rf $RELEASE_DIR_TMP/node_modules
npm install --omit=dev

cd $RELEASE_DIR
tar -czf $RELEASE_DIR/jobman.tar.gz  jobman

