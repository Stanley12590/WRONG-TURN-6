const admin = require('firebase-admin');
const { BufferJSON } = require('@whiskeysockets/baileys');

async function useFirebaseAuthState(collection) {
    const writeData = (data, id) => {
        return collection.doc(id).set(JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
    };

    const readData = async (id) => {
        const doc = await collection.doc(id).get();
        if (doc.exists) {
            return JSON.parse(JSON.stringify(doc.data()), BufferJSON.reviver);
        }
        return null;
    };

    const removeData = async (id) => {
        await collection.doc(id).delete();
    };

    const creds = await readData('creds') || {
        noiseKey: admin.security.generateKeyPair(),
        pairingEphemeralKeyPair: admin.security.generateKeyPair(),
        signedIdentityKey: admin.security.generateKeyPair(),
        signedPreKey: admin.security.generateSignedPreKey(admin.security.generateKeyPair(), 1),
        registrationId: admin.security.generateRegistrationId(),
        advSecretKey: admin.security.generateKeyPair().private,
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSettings: { unarchiveChats: false },
    };

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) value = admin.security.proto.Message.AppStateSyncKeyData.fromObject(value);
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            if (value) await writeData(value, `${type}-${id}`);
                            else await removeData(`${type}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

module.exports = { useFirebaseAuthState };
