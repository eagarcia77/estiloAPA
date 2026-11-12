const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../safari-stream-compat.js'),'utf8');
test('adds values() only when missing and streams chunks',async()=>{
  class LegacyStream {
    constructor(chunks){this.chunks=chunks;this.cancelled=false;this.released=false;}
    getReader(){const stream=this;let i=0;return {
      async read(){return i<stream.chunks.length?{done:false,value:stream.chunks[i++]}:{done:true};},
      async cancel(){stream.cancelled=true;},
      releaseLock(){stream.released=true;}
    };}
  }
  const ctx={ReadableStream:LegacyStream,Symbol};
  vm.runInNewContext(source,ctx);
  const stream=new LegacyStream(['a','b']);
  const values=[];
  for await(const chunk of stream.values())values.push(chunk);
  assert.deepEqual(values,['a','b']);
  assert.equal(stream.released,true);
  assert.equal(stream.cancelled,false);
});
test('preserves existing native values method',()=>{
  class NativeStream {}
  const original=()=>42;
  NativeStream.prototype.values=original;
  vm.runInNewContext(source,{ReadableStream:NativeStream,Symbol});
  assert.equal(NativeStream.prototype.values,original);
});
