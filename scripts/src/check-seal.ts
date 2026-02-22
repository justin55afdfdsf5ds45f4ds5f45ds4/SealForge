import * as seal from '@mysten/seal';
console.log('Exports from @mysten/seal:');
console.log(Object.keys(seal));

// Check for SealClient construction params
console.log('\nSealClient:', typeof seal.SealClient);
console.log('SessionKey:', typeof seal.SessionKey);
console.log('EncryptedObject:', typeof seal.EncryptedObject);
