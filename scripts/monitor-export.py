import subprocess,time,json,pathlib
out=pathlib.Path('.local-data/verification/resources.jsonl')
for _ in range(30):
    rows=[]
    for line in subprocess.check_output(['ps','-axo','pid,ppid,rss,command'],text=True).splitlines()[1:]:
        if ('lyric-editor/MY3' in line and ('tsx' in line or 'ffmpeg' in line)) or 'chrome-headless-shell' in line:
            chunks=line.split(None,3)
            if len(chunks)==4: rows.append({'pid':int(chunks[0]),'ppid':int(chunks[1]),'rssKB':int(chunks[2]),'command':chunks[3][:100]})
    outputs=list(pathlib.Path('.local-data/exports').glob('*.partial.mp4'))
    with out.open('a') as f:f.write(json.dumps({'time':time.time(),'processes':rows,'partialBytes':sum(x.stat().st_size for x in outputs if x.exists())})+'\n')
    if not outputs and _>2:break
    time.sleep(10)
