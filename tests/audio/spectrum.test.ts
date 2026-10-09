import {test,expect} from 'vitest';
import {analyzePcm,spectrumAt,createSpectrumAnalyzer} from '../../src/audio/spectrum';
test('silence is zero energy',()=>expect(spectrumAt(analyzePcm(new Float32Array(24000),24000),0).every(v=>v===0)).toBe(true));
const tone=(hz:number)=>Float32Array.from({length:24000},(_,i)=>Math.sin(2*Math.PI*hz*i/24000)*.5);
test('high and low tones occupy different bands and seek order does not affect energy',()=>{const low=analyzePcm(tone(180),24000),high=analyzePcm(tone(4000),24000);const peak=(a:number[])=>a.indexOf(Math.max(...a));expect(peak(spectrumAt(low,.5))).toBeLessThan(peak(spectrumAt(high,.5)));const first=spectrumAt(low,.1);spectrumAt(low,.8);expect(spectrumAt(low,.1)).toEqual(first)});
test('arbitrary PCM chunk boundaries preserve frames',()=>{const samples=tone(440),stream=createSpectrumAnalyzer(24000);for(let i=0;i<samples.length;i+=537)stream.push(samples.slice(i,i+537));expect(stream.finish()).toEqual(analyzePcm(samples,24000))});
