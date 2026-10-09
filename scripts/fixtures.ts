import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {run} from '../server/probe';
const dir=resolve('.local-data/fixtures');await mkdir(dir,{recursive:true});
for(const [name,duration] of [['짧은 샘플',3],['긴 샘플',180]] as const)await run('ffmpeg',['-y','-v','error','-f','lavfi','-i',`sine=frequency=440:duration=${duration}`,'-af','afade=t=in:d=0.1,volume=0.25','-c:a','libmp3lame',`${dir}/${name}.mp3`]);
await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=0x717887:s=1280x720','-frames:v','1',`${dir}/background.png`]);
await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=640x360:rate=30:duration=2','-c:v','libx264','-pix_fmt','yuv420p',`${dir}/background.mp4`]);
await writeFile(`${dir}/lyrics.json`,JSON.stringify({schemaVersion:1,lyrics:[{start:.3,end:1.2,original:'바람이 머문 자리',pronunciation:'A place in the wind',translation:'이 순간을 기억해'},{start:1.4,end:2.8,original:'風の中で',translation:'바람 속에서'}]},null,2));console.log(dir);
