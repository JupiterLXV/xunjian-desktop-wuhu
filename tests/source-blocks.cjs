const acorn=require('acorn');
module.exports=function blocks(source){
 const result=new Map(),ast=acorn.parse(source,{ecmaVersion:'latest',sourceType:'script'});
 const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)result.set(n.id.name,source.slice(n.start,n.end));if(n.type==='VariableDeclarator'&&n.id?.type==='Identifier')result.set(n.id.name,source.slice(n.start,n.end));for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}};walk(ast);return result;
};
