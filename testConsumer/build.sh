#!/bin/bash

SRC=$(readlink -f "${BASH_SOURCE[0]}")
DIR=$(dirname "$SRC")

# copy example
cp -RT "$DIR/../example" "$DIR/node_modules/example"
# and replace some files
cp -RT "$DIR/node_modules/exampleOverwrite" "$DIR/node_modules/example"

# build the example with a submodule export
cd "$DIR/node_modules/example"
yarn scripts ts-build --exportsMap 'bar:foo/filename'
# and clean up source
rm -r "$DIR/node_modules/example/src"


# build consumer per tsc
cd "$DIR"
rm -rf dist

yarn tsc --outDir dist/cjs --target ES5 --module CommonJS
cat >dist/cjs/package.json <<EOF
{
    "type": "commonjs"
}
EOF

yarn tsc --outDir dist/esm --target ES6 --module ES6
cat >dist/esm/package.json <<EOF
{
    "type": "module"
}
EOF


# bundle consumer per esbuild
cd "$DIR"
rm -rf build

for f in "consumerDeepCjs" "consumerDeepEsm" "consumerMain" "consumerSub"
do
    yarn esbuild src/$f.ts --outfile=build/$f.js --bundle
done
