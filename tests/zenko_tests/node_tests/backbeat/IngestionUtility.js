const assert = require('assert');
const async = require('async');
const crypto = require('crypto');

const { scalityS3Client, ringS3Client } = require('../s3SDK');
const ReplicationUtility = require('./ReplicationUtility');

class IngestionUtility extends ReplicationUtility {
    constructor(s3, ringS3C) {
        super(s3);
        this.ringS3C = ringS3C;
    }

    getSourceObject(bucketName, objName, versionId, cb) {
        this.ringS3C.getObject({
            Bucket: bucketName,
            Key: objName,
            VersionId: versionId,
        }, cb);
    }

    getDestObject(bucketName, objName, versionId, cb) {
        this.s3.getObject({
            Bucket: bucketName,
            Key: objName,
            VersionId: versionId,
        }, cb);
    }

    createIngestionBucket(bucketName, ingestionSrcLocation, cb) {
        this.s3.createBucket({
            Bucket: bucketName,
            CreateBucketConfiguration: {
                LocationConstraint: `${ingestionSrcLocation}:ingest`,
            },
        }, cb);
    }

    waitUntilIngested(bucketName, key, versionId, cb) {
        console.log('wait until ingested!', bucketName, key, versionId);
        let status;
        const expectedCode = 'NotFound';
        return async.doWhilst(callback =>
            this.s3.headObject({
                Bucket: bucketName,
                Key: key,
                VersionId: versionId,
            }, err => {
                if (err && err.code !== expectedCode) {
                    return callback(err);
                }
                status = !err;
                if (!status) {
                    return setTimeout(callback, 2000);
                }
                return callback();
            }),
        () => !status, cb);
    }

    waitUntilEmpty(bucketName, cb) {
        let objectsEmpty;
        return async.doWhilst(callback =>
            this.s3.listObjectVersions({ Bucket: bucketName }, (err, data) => {
                if (err) {
                    return cb(err);
                }
                let versionLength = data.Versions.length;
                let deleteLength = data.DeleteMarkers.length;
                objectsEmpty = (versionLength + deleteLength) === 0;
                if (objectsEmpty) {
                    return callback();
                }
                return setTimeout(callback, 2000);
            }),
        () => !objectsEmpty, cb);
    }

    compareObjectsRINGS3C(srcBucket, destBucket, key, versionId, cb) {
        return async.series([
            next => this.waitUntilIngested(destBucket, key, versionId,
                next),
            next => this.getSourceObject(srcBucket, key, versionId, next),
            next => this.getDestObject(destBucket, key, versionId, next),
        ], (err, data) => {
            if (err) {
                return cb(err);
            }
            const srcData = data[1];
            const destData = data[2];
            assert.strictEqual(srcData.ContentLength,
                destData.ContentLength);
            this._compareObjectBody(srcData.Body, destData.Body);
            assert.deepStrictEqual(srcData.Metadata, destData.Metadata);
            assert.strictEqual(srcData.ETag, destData.ETag);
            assert.strictEqual(srcData.ContentType, destData.ContentType);
            assert.strictEqual(srcData.VersionId, destData.VersionId);
            assert.strictEqual(srcData.LastModified.toString(),
                destData.LastModified.toString());
            if (srcData.WebsiteRedirectLocation) {
                assert.strictEqual(srcData.WebsiteRedirectLocation,
                    destData.WebsiteRedirectLocation);
            }
            return cb();
        });
    }

    compareObjectTagsRINGS3C(srcBucket, destBucket, key, versionId, cb) {
        return async.series([
            next => this.waitUntilIngested(srcBucket, key, versionId, err => {
                console.log('wait until Ingested');
                return next(err, data);
            }),
            next => this._setS3Client(ringS3Client).getObjectTagging(srcBucket,
                key, versionId, (err, data) => {
                    console.log('get object tagging for ring object', data);
                    return next(err, data);
                }),
            next => this._setS3Client(scalityS3Client).getObjectTagging(destBucket, key,
                versionId, (err, data) => {
                    console.log('get object tagging for scality object');
                    return next(err, data);
                }),
        ], (err, data) => {
            console.log('async series in compare object tags complete');
            if (err) {
                return cb(err);
            }
            const srcData = data[1];
            const destData = data[2];
            assert.deepStrictEqual(srcData.TagSet, destData.TagSet);
            assert.strictEqual(srcData.VersionId, destData.VersionId);
            return cb();
        });
    }
}

module.exports = IngestionUtility;
