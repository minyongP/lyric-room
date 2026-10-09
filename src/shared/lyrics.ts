import {z} from 'zod';
export const cueSchema=z.object({start:z.number().min(0),end:z.number().positive(),original:z.string().trim().min(1).max(10000),pronunciation:z.string().max(10000).optional(),translation:z.string().max(10000).optional()});
export type LyricCue=z.infer<typeof cueSchema>;
export function parseLyrics(input:unknown,duration:number):{ok:true;lyrics:LyricCue[]}|{ok:false;errors:{cue:number|null;field:string;message:string}[]}{
 const r=z.object({schemaVersion:z.literal(1).optional(),lyrics:z.array(cueSchema).max(10000)}).safeParse(input);
 if(!r.success)return {ok:false,errors:r.error.issues.map(i=>({cue:typeof i.path[1]==='number'?i.path[1]+1:null,field:String(i.path.at(-1)||'lyrics'),message:i.message}))};
 const errors:{cue:number;field:string;message:string}[]=[];r.data.lyrics.forEach((c,i)=>{if(c.end<=c.start||c.end>duration)errors.push({cue:i+1,field:'end',message:'종료 시간은 시작 시간 이후, 곡 길이 이내여야 합니다.'});if(i&&r.data.lyrics[i-1].end>c.start)errors.push({cue:i+1,field:'start',message:'가사 시간이 겹치거나 순서가 바뀌었습니다.'})});return errors.length?{ok:false,errors}:{ok:true,lyrics:r.data.lyrics};
}
export function cueWindow(cues:LyricCue[],t:number){let lo=0,hi=cues.length;while(lo<hi){const mid=(lo+hi)>>1;if(cues[mid].start<=t)lo=mid+1;else hi=mid}const i=lo-1,current=i>=0&&t<cues[i].end?i:null;return {previous:current!==null?(current>0?current-1:null):(i>=0?i:null),current,next:lo<cues.length?lo:null}}
