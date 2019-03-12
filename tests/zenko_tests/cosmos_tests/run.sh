#!/bin/sh

set -x
set -u
set -e
set -o pipefail

# echo $MONGODB_HOST
echo $CLOUDSERVER_ENDPOINT
echo $ZENKO_ACCESS_KEY
echo $ZENKO_SECRET_KEY

# MONGODB_HOSTS=${MONGODB_HOST:-"localhost:27017"}
# mongo "$MONGODB_HOST" ./addCosmosLocation.js

CLOUDSERVER_ENDPOINT=${CLOUDSERVER_ENDPOINT:-"localhost:8000"}
AWS_ACCESS_KEY_ID="$ZENKO_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$ZENKO_SECRET_KEY" \
aws s3 --endpoint "$CLOUDSERVER_ENDPOINT" mb s3://ci-nfs-ingestion --region 'nfsbackend:ingest'
sleep 360
