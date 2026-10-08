'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {
  createProviderPorts,
  configuredProviderNames
}=require('../src/providers');

test('provider factory only enables configured server transports',()=>{
  const fetchFn=async()=>{ throw new Error('not called'); };
  const config={
    providers:{
      exa:'exa-key',
      apollo:null,
      anthropic:'anthropic-key'
    },
    anthropicModel:'claude-test'
  };

  const ports=createProviderPorts({config,fetchFn});

  assert.equal(typeof ports.search,'function');
  assert.equal(typeof ports.fetch,'function');
  assert.equal(ports.apollo,undefined);
  assert.equal(typeof ports.llm.complete,'function');
  assert.deepEqual(configuredProviderNames(config),['exa','anthropic']);
});

test('provider factory is honest when nothing is configured',()=>{
  const config={providers:{exa:null,apollo:null,anthropic:null}};
  assert.deepEqual(createProviderPorts({config,fetchFn:async()=>{}}),{});
  assert.deepEqual(configuredProviderNames(config),[]);
});

test('provider factory requires config',()=>{
  assert.throws(()=>createProviderPorts(),/requires config/);
});
