import fs from 'fs';
import Lightwallet from 'eth-lightwallet';
import ProviderEngine from 'web3-provider-engine';

var FiltersSubprovider = require('web3-provider-engine/subproviders/filters.js');
var HookedSubprovider = require('web3-provider-engine/subproviders/hooked-wallet.js');
var Web3Subprovider = require('web3-provider-engine/subproviders/web3.js');
var Web3 = require('web3');
var Transaction = require('ethereumjs-tx');

export default class LightwalletProvider {
  constructor (opts) {
    this.opts = opts;
    this.init();
  }

  init () {
    this.opts.serialized = fs.readFileSync(this.opts.keystore).toString();
    this.opts.ks = Lightwallet.keystore.deserialize(this.opts.serialized);
    this.opts.ks.keyFromPassword(this.opts.password, (err, pwDerivedKey) => {
      if (err) throw err;
      this.addresses = this.opts.ks.getAddresses();
    });

    this.engine = new ProviderEngine();
    this.engine.addProvider(new HookedSubprovider({
      getAccounts: (cb) => {
        this.opts.ks.keyFromPassword(this.opts.password, (err, pwDerivedKey) => {
          if (err) throw err;
          this.addresses = this.opts.ks.getAddresses();
          cb(null, this.addresses)
        });
      },
      getPrivateKey: (address, cb) => {
        this.opts.ks.keyFromPassword(this.opts.password, (err, pwDerivedKey) => {
          if (err) return cb(err);
          const secretKey = Buffer.from(this.opts.ks.exportPrivateKey(address, pwDerivedKey), 'hex');
          if (!secretKey) cb('Account not found', null);
          cb(null, secretKey);
        });
      },
      signTransaction: (txParams, cb) => {
        this.opts.ks.keyFromPassword(this.opts.password, (err, pwDerivedKey) => {
          if (err) return cb(err);
          console.log(this.opts.ks.getAddresses());
          const secretKey = Buffer.from(this.opts.ks.exportPrivateKey(txParams.from, pwDerivedKey), 'hex');
          if (!secretKey) cb('Account not found', null);
          var tx = new Transaction(txParams);
          tx.sign(secretKey);
          var rawTx = '0x' + tx.serialize().toString('hex');
          console.log(rawTx);
          cb(null, rawTx);
        });
      }
    }));
    this.engine.addProvider(new FiltersSubprovider());
    this.engine.addProvider(new Web3Subprovider(new Web3.providers.HttpProvider(this.opts.rpcUrl)));
    this.engine.start(); // Required by the provider engine.
  }

  send () {
    return this.engine.sendAsync.apply(this.engine, arguments);
  }
  sendAsync () {
    this.engine.sendAsync.apply(this.engine, arguments);
  }

  getAddress (idx) {
    if (!idx) return this.addresses[0];
    return this.addresses[idx];
  }

  getAddresses () {
    return this.addresses;
  }
}
