var pensieve = db.getSiblingDB('metadata').getCollection('PENSIEVE');
var version = pensieve.findOne({_id:'configuration/overlay-version'}).value;
var latest = pensieve.findOne({_id:'configuration/overlay/'+version});
var newVersion = version + 1
latest._id = 'configuration/overlay/'+newVersion;
latest.value.version = newVersion
pensieve.insert(latest)
pensieve.update({_id:'configuration/overlay-version'}, {"value":newVersion})
pensieve.update({ _id: 'configuration/overlay/'+newVersion }, {
    $set: {
        'value.locations.nfslocation': {
            'details': {
                "endpoint" : 'tcp+v3://$NFS_ENDPOINT/data',
            },
            'locationType': 'location-nfs-mount-v1',
            'name' : 'nfslocation',
            'objectId' : '8a6efe18-413d-11e9-8aa9-9a2568e1703e',
        }
    }
})
