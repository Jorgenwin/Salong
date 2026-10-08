'use strict';

const {createApolloPort}=require('./apollo');
const {createExaPorts}=require('./exa');
const {createAnthropicPort,DEFAULT_MODEL}=require('./anthropic');

function createProviderPorts({config,fetchFn=global.fetch}={}){
  if(!config) throw new TypeError('createProviderPorts requires config');
  const providers=config.providers||{};
  const ports={};

  if(providers.exa){
    const exa=createExaPorts({apiKey:providers.exa,fetchFn});
    ports.search=exa.search;
    ports.fetch=exa.fetch;
  }

  if(providers.apollo){
    ports.apollo=createApolloPort({
      apiKey:providers.apollo,
      fetchFn
    });
  }

  if(providers.anthropic){
    ports.llm=createAnthropicPort({
      apiKey:providers.anthropic,
      model:config.anthropicModel||DEFAULT_MODEL,
      fetchFn
    });
  }

  return ports;
}

function configuredProviderNames(config={}){
  const ports=config.providers||{};
  return [
    ports.exa&&'exa',
    ports.apollo&&'apollo',
    ports.anthropic&&'anthropic'
  ].filter(Boolean);
}

module.exports={
  createProviderPorts,
  configuredProviderNames
};
