globalThis.MMPackagedRules=Object.freeze([Object.freeze({
  format:"mercenary-moderators.packaged-rule/v1",
  id:"tag-post-v1",
  target:Object.freeze({host:"boards.4chan.org",pathPattern:"/*/thread/*"}),
  parentSelector:"#post-menu > ul",
  tag:"li",
  text:"Tag Post",
  position:"first",
  behavior:"local-component",
  component:Object.freeze({kind:"post-tags/v1"})
}),Object.freeze({
  format:"mercenary-moderators.packaged-rule/v1",
  id:"search-post-market-v1",
  target:Object.freeze({host:"boards.4chan.org",pathPattern:"/*/thread/*"}),
  parentSelector:"#post-menu > ul",
  tag:"li",
  text:"Search tags on Market",
  position:"second",
  behavior:"local-component",
  component:Object.freeze({kind:"post-tags/v1",action:"search-market"})
})]);
